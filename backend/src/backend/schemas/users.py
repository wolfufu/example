from pydantic import BaseModel, ConfigDict, EmailStr, Field


class TwoFASetupResponse(BaseModel):
    secret: str
    provisioning_uri: str
    qr_code_base64: str


class TwoFAVerifyRequest(BaseModel):
    code: str = Field(min_length=6, max_length=6)


class TwoFAChallengeVerifyRequest(BaseModel):
    challenge_token: str
    code: str = Field(min_length=6, max_length=6)


class LoginResponse(BaseModel):
    access_token: str | None = None
    token_type: str | None = None
    mfa_required: bool = False
    challenge_token: str | None = None


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str


class UserRead(BaseModel):
    id: int
    name: str
    email: EmailStr
    is_active: bool
    is_superuser: bool
    is_2fa_enabled: bool = False

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str
