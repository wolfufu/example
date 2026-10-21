from typing import Annotated

from backend.auth.auth import (
    create_access_token,
    create_refresh_token,
    get_current_user,
)
from backend.auth.two_factor import (
    build_provisioning_uri,
    build_qr_base64,
    consume_mfa_challenge,
    generate_totp_secret,
    verify_totp,
)
from backend.database.database import get_db
from backend.database.redis import redis_client
from backend.models.users import User
from backend.routers.auth.auth import _set_refresh_cookie
from backend.schemas.users import (
    LoginResponse,
    TwoFAChallengeVerifyRequest,
    TwoFASetupResponse,
    TwoFAVerifyRequest,
)
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/2fa", tags=["2fa"])


@router.post("/2fa/setup", response_model=TwoFASetupResponse)
async def setup_2fa(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TwoFASetupResponse:
    if current_user.is_2fa_enabled:
        raise HTTPException(status_code=409, detail="2FA already enabled")

    secret = generate_totp_secret()
    uri = build_provisioning_uri(secret, current_user.email)

    await redis_client.set(
        f"mfa:pending:{current_user.id}",
        secret,
        ex=600,
    )

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
    secret = await redis_client.get(pending_key)
    if not secret:
        raise HTTPException(status_code=400, detail="2FA setup expired, start again")

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
        # Challenge уже удалён — повторно использовать нельзя
        raise HTTPException(status_code=401, detail="Invalid TOTP code")

    access_token = create_access_token({"sub": user.email})
    refresh_token = create_refresh_token({"sub": user.email})
    _set_refresh_cookie(response, refresh_token)

    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        mfa_required=False,
    )
