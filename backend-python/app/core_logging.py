import logging
from logging.handlers import RotatingFileHandler
import os
import sys
from app.config import get_settings

settings = get_settings()

def setup_logging():
    """
    Configures low-overhead, rotating file and console logging.
    - Production: Rotates files at 5MB, keeps max 3 backups to protect cPanel disk quota.
    - Format: Lightweight timestamp, log level, module, message.
    - Prevents noisy 3rd-party loggers from saturating I/O.
    """
    log_level = logging.DEBUG if settings.DEBUG else getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)

    # 1. Base root logger configuration
    formatter = logging.Formatter(
        fmt="%(asctime)s [%(levelname)s] [%(name)s]: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)

    # Clear existing handlers to avoid duplicates on reloads
    root_logger.handlers.clear()

    # 2. Console Handler (stdout)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    console_handler.setLevel(log_level)
    root_logger.addHandler(console_handler)

    # 3. Rotating File Handler (protected against cPanel disk fill)
    try:
        log_dir = os.path.abspath(settings.LOG_DIR)
        os.makedirs(log_dir, exist_ok=True)
        log_file = os.path.join(log_dir, "app.log")

        file_handler = RotatingFileHandler(
            filename=log_file,
            maxBytes=settings.LOG_MAX_BYTES,
            backupCount=settings.LOG_BACKUP_COUNT,
            encoding="utf-8",
        )
        file_handler.setFormatter(formatter)
        file_handler.setLevel(log_level)
        root_logger.addHandler(file_handler)
    except Exception as e:
        # If filesystem permissions block creating the log folder, gracefully continue on console
        sys.stderr.write(f"Warning: Failed to initialize file logging: {e}\n")

    # 4. Suppress excessively noisy 3rd-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("aiosqlite").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("passlib").setLevel(logging.WARNING)

def get_logger(name: str) -> logging.Logger:
    """Returns a named logger instance."""
    return logging.getLogger(name)
