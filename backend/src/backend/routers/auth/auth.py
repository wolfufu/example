from typing import Annotated

import jwt
from backend.auth.auth import (
    create_access_token,
    create_refresh_token,
    get_current_user,
    get_password_hash,
    verify_password,
)
from backend.auth.two_factor import (
    build_provisioning_uri,
    build_qr_base64,
    consume_mfa_challenge,
    create_mfa_challenge,
    generate_totp_secret,
    verify_totp,
)
from backend.config import settings
from backend.database.database import get_db
from backend.database.redis import redis_client
from backend.models.users import User
from backend.schemas.users import (
    LoginResponse,
    Token,
    TwoFAChallengeVerifyRequest,
    TwoFASetupResponse,
    TwoFAVerifyRequest,
    UserCreate,
    UserRead,
)
from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE_NAME = "refresh_token"
REFRESH_COOKIE_PATH = "/auth"


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=token,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN,
        path=REFRESH_COOKIE_PATH,
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=REFRESH_COOKIE_NAME,
        path=REFRESH_COOKIE_PATH,
        domain=settings.COOKIE_DOMAIN,
    )


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register(
    user_in: UserCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserRead:
    result = await db.execute(select(User).where(User.email == user_in.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = User(
        name=user_in.name,
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return UserRead.model_validate(new_user)


@router.post("/login", response_model=LoginResponse)
async def login(
    response: Response,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> LoginResponse:
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalar_one_or_none()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.is_2fa_enabled:
        challenge = await create_mfa_challenge(user.id)
        return LoginResponse(mfa_required=True, challenge_token=challenge)

    access_token = create_access_token({"sub": user.email})
    refresh_token = create_refresh_token({"sub": user.email})
    _set_refresh_cookie(response, refresh_token)

    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        mfa_required=False,
    )


@router.post("/refresh", response_model=Token)
async def refresh(
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
    refresh_token: Annotated[str | None, Cookie(alias=REFRESH_COOKIE_NAME)] = None,
) -> Token:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or missing refresh token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not refresh_token:
        raise credentials_exception

    try:
        payload = jwt.decode(
            refresh_token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
    except jwt.PyJWTError:
        _clear_refresh_cookie(response)
        raise credentials_exception

    if payload.get("type") != "refresh":
        _clear_refresh_cookie(response)
        raise credentials_exception

    email: str | None = payload.get("sub")
    if not email:
        _clear_refresh_cookie(response)
        raise credentials_exception

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None:
        _clear_refresh_cookie(response)
        raise credentials_exception

    new_access = create_access_token({"sub": user.email})
    new_refresh = create_refresh_token({"sub": user.email})
    _set_refresh_cookie(response, new_refresh)

    return Token(access_token=new_access, token_type="bearer")


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response) -> None:
    _clear_refresh_cookie(response)


@router.get("/me", response_model=UserRead)
async def read_users_me(
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserRead:
    return UserRead.model_validate(current_user)


# ─────────────────────────────────────────────────────────────
# 2FA
# ─────────────────────────────────────────────────────────────


@router.post("/2fa/setup", response_model=TwoFASetupResponse)
async def setup_2fa(
    current_user: Annotated[User, Depends(get_current_user)],
) -> TwoFASetupResponse:
    if current_user.is_2fa_enabled:
        raise HTTPException(status_code=409, detail="2FA already enabled")

    secret = generate_totp_secret()
    uri = build_provisioning_uri(secret, current_user.email)

    await redis_client.set(f"mfa:pending:{current_user.id}", secret, ex=600)

    return TwoFASetupResponse(
        secret=secret,
        provisioning_uri=uri,
        qr_code_base64=build_qr_base64(uri),
    )


@router.post("/2fa/verify", status_code=status.HTTP_200_OK)
async def verify_2fa(
    body: TwoFAVerifyRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    pending_key = f"mfa:pending:{current_user.id}"
    raw = await redis_client.get(pending_key)
    if not raw:
        raise HTTPException(status_code=400, detail="2FA setup expired, start again")

    secret = raw.decode() if isinstance(raw, bytes) else raw

    if not verify_totp(secret, body.code):
        raise HTTPException(status_code=400, detail="Invalid TOTP code")

    current_user.totp_secret = secret
    current_user.is_2fa_enabled = True
    await db.commit()
    await redis_client.delete(pending_key)

    return {"detail": "2FA enabled"}


@router.post("/2fa/disable", status_code=status.HTTP_200_OK)
async def disable_2fa(
    body: TwoFAVerifyRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if not current_user.is_2fa_enabled or not current_user.totp_secret:
        raise HTTPException(status_code=400, detail="2FA is not enabled")

    if not verify_totp(current_user.totp_secret, body.code):
        raise HTTPException(status_code=400, detail="Invalid TOTP code")

    current_user.is_2fa_enabled = False
    current_user.totp_secret = None
    await db.commit()

    return {"detail": "2FA disabled"}


@router.post("/2fa/challenge/verify", response_model=LoginResponse)
async def verify_mfa_challenge(
    body: TwoFAChallengeVerifyRequest,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> LoginResponse:
    user_id = await consume_mfa_challenge(body.challenge_token)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Challenge expired or invalid")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None or not user.is_2fa_enabled or not user.totp_secret:
        raise HTTPException(status_code=401, detail="Invalid challenge")

    if not verify_totp(user.totp_secret, body.code):
        raise HTTPException(status_code=401, detail="Invalid TOTP code")

    access_token = create_access_token({"sub": user.email})
    refresh_token = create_refresh_token({"sub": user.email})
    _set_refresh_cookie(response, refresh_token)

    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        mfa_required=False,
    )
