from functools import lru_cache
from pathlib import Path
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = Path(__file__).resolve().parent.parent
_DEFAULT_DB_FILE = (_BACKEND_DIR / "pos.db").as_posix()

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @model_validator(mode="after")
    def ensure_utf8mb4_mysql(self) -> "Settings":
        for attr in ("DATABASE_URL", "SYNC_DATABASE_URL"):
            val = getattr(self, attr, "")
            if "mysql" in val and "charset=" not in val:
                sep = "&" if "?" in val else "?"
                setattr(self, attr, f"{val}{sep}charset=utf8mb4")
        return self

    APP_NAME: str = "Messers Rajib Enterprise"
    ENV: str = "production"
    ENVIRONMENT: str = "production"
    DEBUG: bool = False
    ALLOW_DEV_PIN: bool = False  # Strictly False in production; only enabled in local dev/tests
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    LOG_LEVEL: str = "INFO"
    LOG_DIR: str = "logs"
    LOG_MAX_BYTES: int = 5 * 1024 * 1024  # 5 MB per file
    LOG_BACKUP_COUNT: int = 3  # Keep at most 3 historical files
    DATABASE_URL: str = f"sqlite+aiosqlite:///{_DEFAULT_DB_FILE}"
    SYNC_DATABASE_URL: str = f"sqlite:///{_DEFAULT_DB_FILE}"
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
