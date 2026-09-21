from collections.abc import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from app.config import get_settings

settings = get_settings()

engine_kwargs = {
    "echo": False,
    "pool_pre_ping": True,
}

if "sqlite" not in settings.DATABASE_URL:
    engine_kwargs.update({
        "pool_size": settings.DB_POOL_SIZE,
        "max_overflow": settings.DB_MAX_OVERFLOW,
        "pool_recycle": settings.DB_POOL_RECYCLE,
    })

engine = create_async_engine(settings.DATABASE_URL, **engine_kwargs)

async_session_maker = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
