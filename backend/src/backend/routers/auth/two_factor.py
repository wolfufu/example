from typing import Annotated

from backend.auth.auth import (
    create_access_token,
    create_refresh_token,
    get_current_user,
)
from backend.auth.cookies import set_refresh_cookie
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
from backend.schemas.users import (
    LoginResponse,
    TwoFAChallengeVerifyRequest,
    TwoFASetupResponse,
    TwoFAVerifyRequest,
)
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/auth/2fa", tags=["Authentication"])


@router.post(
    "/setup",
    response_model=TwoFASetupResponse,
    summary="Start setting up 2FA",
    description=(
        "Generates a TOTP secret and temporarily stores it in Redis (TTL 10 minutes). "
        "Returns the secret, provisioning URI, and QR code in base64 for scanning "
        "in Google Authenticator/ Authy. "
        "Requires authorization. If 2FA is already enabled, it returns 409."
    ),
)
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


@router.post(
    "/verify",
    status_code=status.HTTP_200_OK,
    summary="Confirm and enable 2FA",
    description=(
        "Accepts a 6-digit code from the authenticator application. "
        "Checks it against the secret saved in the `/setup` step in Redis. "
        "On success, writes the secret to the database and sets the `is_2fa_enabled` flag. "
        "Requires authorization."
    ),
)
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


@router.post(
    "/disable",
    status_code=status.HTTP_200_OK,
    summary="Disable 2FA",
    description=(
        "Requires a valid 6-digit TOTP code. "
        "On success, deletes the secret and removes the `is_2fa_enabled` flag. "
        "Requires authorization."
    ),
)
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


@router.post(
    "/challenge/verify",
    response_model=LoginResponse,
    summary="Complete login with 2FA",
    description=(
        "Accepts a `challenge_token` (from the response `/auth/login`) and a 6-digit code. "
        "Checks the code against the secret from the database. "
        "On success, it issues an `access_token` and rotates an HttpOnly cookie with a refresh token. "
        "Does not require authorization (the user is still in the login process)."
    ),
)
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

    set_refresh_cookie(response, refresh_token)

    return LoginResponse(access_token=access_token, mfa_required=False)
