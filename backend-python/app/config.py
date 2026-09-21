from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "Al-Amin POS & Inventory System"
    ENV: str = "production"
    ENVIRONMENT: str = "production"
    DEBUG: bool = False
    PORT: int = 8000
    LOG_LEVEL: str = "INFO"
    LOG_DIR: str = "logs"
    LOG_MAX_BYTES: int = 5 * 1024 * 1024  # 5 MB per file
    LOG_BACKUP_COUNT: int = 3  # Keep at most 3 historical files
    DATABASE_URL: str = "sqlite+aiosqlite:///./pos.db"
    SYNC_DATABASE_URL: str = "sqlite:///./pos.db"
    JWT_SECRET: str = "PosSystemSecureKey2026SecureSecretForHmacSha256MustBe32BytesOrLonger"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    TIMEZONE: str = "Asia/Dhaka"
    DB_POOL_SIZE: int = 2
    DB_MAX_OVERFLOW: int = 3
    DB_POOL_RECYCLE: int = 280
    CORS_ORIGINS: list[str] = [
        "http://localhost:8443",
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:8443",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "*",
    ]

@lru_cache
def get_settings() -> Settings:
    return Settings()
