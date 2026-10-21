import base64
import io
import secrets

import pyotp
import qrcode

from backend.config import settings
from backend.database.redis import redis_client

CHALLENGE_KEY = "mfa:challenge:{token}"


def generate_totp_secret() -> str:
    return pyotp.random_base32()


def build_provisioning_uri(secret: str, email: str) -> str:
    return pyotp.TOTP(secret).provisioning_uri(
        name=email, issuer_name=settings.MFA_ISSUER_NAME
    )


def build_qr_base64(provisioning_uri: str) -> str:
    img = qrcode.make(provisioning_uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")  # type: ignore[call-arg]
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def verify_totp(secret: str, code: str) -> bool:
    return pyotp.TOTP(secret).verify(code, valid_window=1)


async def create_mfa_challenge(user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    await redis_client.set(
        CHALLENGE_KEY.format(token=token),
        str(user_id),
        ex=settings.MFA_CHALLENGE_TTL_SECONDS,
    )
    return token


async def consume_mfa_challenge(token: str) -> int | None:
    """Атомарно читает и удаляет challenge. Возвращает user_id или None."""
    key = CHALLENGE_KEY.format(token=token)
    user_id = await redis_client.get(key)
    if user_id is None:
        return None
    await redis_client.delete(key)
    return int(user_id)
