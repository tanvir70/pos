from pydantic import Field
from app.schemas.base import CamelModel

class LoginRequest(CamelModel):
    username: str
    password: str

class AuthTokenResponse(CamelModel):
    token: str
    role: str
    expires_in: int
    username: str | None = None
    full_name: str | None = None

class UserProfileResponse(CamelModel):
    id: int
    username: str
    full_name: str | None = None
    role: str
    active: bool

class ChangePasswordRequest(CamelModel):
    current_password: str = Field(description="Current user password")
    new_password: str = Field(description="New password (minimum 6 characters)")

class ChangePasswordResponse(CamelModel):
    status: str
    message: str

