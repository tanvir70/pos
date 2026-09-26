from datetime import datetime
from zoneinfo import ZoneInfo
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import get_settings
from app.models.sequence import DocumentSequence

settings = get_settings()

def format_sequence_code(prefix: str, date_str: str, val: int) -> str:
    # 7-digit zero-padded sequence formatting as requested
    return f"{prefix}-{date_str}-{val:07d}"

def calculate_next_val(current_val: int, max_val: int) -> int:
    if current_val >= max_val:
        return 1
    return current_val + 1

async def get_next_sequence(session: AsyncSession, sequence_name: str) -> str:
    stmt = select(DocumentSequence).where(DocumentSequence.sequence_name == sequence_name)
    bind = session.bind
    is_sqlite = bool(bind and getattr(bind, "dialect", None) and bind.dialect.name == "sqlite")
    if not is_sqlite:
        stmt = stmt.with_for_update()

    res = await session.execute(stmt)
    seq = res.scalar_one_or_none()
    if not seq:
        # Auto-seed sequence if missing
        default_prefixes = {
            "sale_invoice": "INV",
            "due_invoice": "DUE",
            "sale_return": "RET",
            "stock_adjustment": "ADJ",
        }
        prefix = default_prefixes.get(sequence_name, sequence_name[:3].upper())
        seq = DocumentSequence(
            sequence_name=sequence_name,
            current_val=0,
            prefix=prefix,
            max_val=9999999,
        )
        session.add(seq)
        await session.flush()

    seq.current_val = calculate_next_val(seq.current_val, seq.max_val)
    today_bd = datetime.now(ZoneInfo(settings.TIMEZONE)).strftime("%Y%m%d")
    return format_sequence_code(seq.prefix, today_bd, seq.current_val)
