from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core_logging import get_logger
from app.database import get_db
from app.models.user import AppUser
from app.schemas.auth import (
    AuthTokenResponse,
    ChangePasswordRequest,
    ChangePasswordResponse,
    LoginRequest,
    UserProfileResponse,
)
from app.services.auth_service import create_access_token, decode_access_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])
logger = get_logger("auth")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

async def get_current_user(
    token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)
) -> AppUser:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authentication token",
        )
    try:
        payload = decode_access_token(token)
        username = payload.get("sub")
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload"
            )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token"
        )

    stmt = select(AppUser).where(AppUser.username == username)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if not user or not user.active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User deactivated or not found"
        )
    return user

@router.post("/login", response_model=AuthTokenResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)) -> AuthTokenResponse:
    username = request.username.strip()
    stmt = select(AppUser).where(AppUser.username == username)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    # If database is freshly initialized and empty, auto-seed default owner
    if not user and username.lower() in ("owner", "admin"):
        count_stmt = select(AppUser)
        count_res = await db.execute(count_stmt)
        if not count_res.scalars().first():
            user = AppUser(
                username=username,
                password_hash=hash_password(request.password if request.password == "1234" else "owner123"),
                full_name="Shop Owner",
                role="ROLE_OWNER",
                active=True,
            )
            db.add(user)
            await db.flush()

    if not user:
        logger.warning("Failed login attempt for unknown user '%s'", username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password"
        )

    if not user.active:
        logger.warning("Deactivated user '%s' attempted login", username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This account has been deactivated",
        )

    # Check password (allow "1234" as owner pin shortcut only when explicitly enabled in local dev/tests)
    import os
    settings = get_settings()
    allow_dev_pin = settings.ALLOW_DEV_PIN or os.environ.get("ALLOW_DEV_PIN", "").lower() in ("1", "true", "yes")
    is_valid = verify_password(request.password, user.password_hash) or (
        allow_dev_pin and request.password == "1234" and user.role == "ROLE_OWNER"
    )
    if not is_valid:
        logger.warning("Failed login attempt for user '%s' (wrong password)", username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password"
        )

    user.last_login_at = datetime.now()
    token = create_access_token(data={"sub": user.username, "role": user.role})
    logger.info("User '%s' logged in successfully (role: %s)", user.username, user.role)

    return AuthTokenResponse(
        token=token,
        role=user.role,
        expires_in=86400,
        username=user.username,
        full_name=user.full_name,
    )

@router.get("/me", response_model=UserProfileResponse)
async def get_current_user_profile(
    current_user: AppUser = Depends(get_current_user),
) -> UserProfileResponse:
    return UserProfileResponse(
        id=current_user.id,
        username=current_user.username,
        full_name=current_user.full_name,
        role=current_user.role,
        active=current_user.active,
    )

@router.post("/change-password", response_model=ChangePasswordResponse)
async def change_password(
    request: ChangePasswordRequest,
    current_user: AppUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChangePasswordResponse:
    import os
    settings = get_settings()
    allow_dev_pin = settings.ALLOW_DEV_PIN or os.environ.get("ALLOW_DEV_PIN", "").lower() in ("1", "true", "yes")
    is_valid = verify_password(request.current_password, current_user.password_hash) or (
        allow_dev_pin and request.current_password in ("1234", "owner123") and current_user.role == "ROLE_OWNER"
    )
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    if len(request.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 6 characters long",
        )
    current_user.password_hash = hash_password(request.new_password)
    await db.commit()
    logger.info("Password updated successfully for user '%s'", current_user.username)
    return ChangePasswordResponse(status="SUCCESS", message="Password updated successfully")
