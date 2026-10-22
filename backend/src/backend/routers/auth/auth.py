from typing import Annotated

import jwt
from backend.auth.auth import (
    create_access_token,
    create_refresh_token,
    get_current_user,
    get_password_hash,
    verify_password,
)
from backend.auth.cookies import (
    REFRESH_COOKIE_NAME,
    clear_refresh_cookie,
    set_refresh_cookie,
)
from backend.auth.two_factor import create_mfa_challenge
from backend.config import settings
from backend.database.database import get_db
from backend.models.users import User
from backend.schemas.users import LoginResponse, Token, UserCreate, UserRead
from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/auth", tags=["Authorization"])


@router.post(
    "/register",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
    summary="Registering a new user",
    description=(
        "Creates a new account. "
        "If the email is already busy, it returns 400. "
        "The password is hashed by bcrypt before being saved."
    ),
)
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


@router.post(
    "/login",
    response_model=LoginResponse,
    summary="Log in by email and password",
    description=(
        "Accepts `username` (email) and `password` in form-data. "
        "If the user has 2FA enabled, returns `mfa_required=true` and "
        "the `challenge_token` to be passed to "
        "`POST /auth/2fa/challenge/verify`. "
        "Otherwise, it immediately issues an `access_token` and puts refresh in an HttpOnly cookie."
    ),
)
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

    set_refresh_cookie(response, refresh_token)

    return LoginResponse(access_token=access_token, mfa_required=False)


@router.post(
    "/refresh",
    response_model=Token,
    summary="Update token",
    description=(
        "Reads the refresh token from the HttpOnly cookie, verifies the signature and expiration date. "
        "If everything is OK, it returns a new access token and rotates the refresh cookie. "
        "If refresh has expired or is invalid, it clears the cookie and returns a 401."
    ),
)
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
    except jwt.ExpiredSignatureError:
        clear_refresh_cookie(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.PyJWTError:
        clear_refresh_cookie(response)
        raise credentials_exception

    if payload.get("type") != "refresh":
        clear_refresh_cookie(response)
        raise credentials_exception

    email: str | None = payload.get("sub")
    if not email:
        clear_refresh_cookie(response)
        raise credentials_exception

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None:
        clear_refresh_cookie(response)
        raise credentials_exception

    new_access = create_access_token({"sub": user.email})
    new_refresh = create_refresh_token({"sub": user.email})

    set_refresh_cookie(response, new_refresh)

    return Token(access_token=new_access)


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Log out of the system",
    description="Clears the HttpOnly cookie with a refresh token. The response body is empty.",
)
async def logout(response: Response) -> None:
    clear_refresh_cookie(response)


@router.get(
    "/me",
    response_model=UserRead,
    summary="Current user",
    description=(
        "Returns the profile of the user who owns the access token. "
        "Requires the header `Authorization: Bearer <access_token>`."
    ),
)
async def read_users_me(
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserRead:
    return UserRead.model_validate(current_user)
