from datetime import datetime
from sqlalchemy import BigInteger, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base

class DocumentSequence(Base):
    __tablename__ = "document_sequences"

    sequence_name: Mapped[str] = mapped_column(String(64), primary_key=True)
    current_val: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    prefix: Mapped[str] = mapped_column(String(16), nullable=False)
    max_val: Mapped[int] = mapped_column(BigInteger, default=9999999, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=func.current_timestamp(), onupdate=func.current_timestamp()
    )
