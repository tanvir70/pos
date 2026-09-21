from datetime import datetime
from sqlalchemy import BigInteger, Boolean, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class AppUser(Base):
    __tablename__ = "app_user"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    version: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    username: Mapped[str] = mapped_column(String(60), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    role: Mapped[str] = mapped_column(String(30), default="ROLE_CASHIER", nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.current_timestamp(), nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
