from datetime import datetime
from sqlalchemy import BigInteger, DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

class Base(DeclarativeBase):
    pass

class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=func.current_timestamp(), nullable=False
    )
