from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    SECRET_KEY: str = "super_secret_key_change_me_in_production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost/dbname"

    # Настройки refresh-cookie
    COOKIE_SECURE: bool = False  # True в проде (HTTPS)
    COOKIE_SAMESITE: Literal["lax", "strict", "none"] = "lax"
    COOKIE_DOMAIN: str | None = None

    REDIS_URL: str = "redis://localhost:6379/0"
    MFA_CHALLENGE_TTL_SECONDS: int = 300
    MFA_ISSUER_NAME: str = "MyApp"

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()
