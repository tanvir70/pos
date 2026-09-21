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
