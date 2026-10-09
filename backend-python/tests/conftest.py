import os
import tempfile
import pytest

# Set testing environment variables before any app modules are loaded
os.environ["ENV"] = "test"
os.environ["ENVIRONMENT"] = "test"
os.environ["ALLOW_DEV_PIN"] = "true"

TEST_DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "test_pos.db"))
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{TEST_DB_PATH}"
os.environ["SYNC_DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"

def _remove_db_files():
    if os.path.exists(TEST_DB_PATH):
        try:
            os.remove(TEST_DB_PATH)
        except Exception:
            pass
    for ext in ["-wal", "-shm"]:
        p = f"{TEST_DB_PATH}{ext}"
        if os.path.exists(p):
            try:
                os.remove(p)
            except Exception:
                pass

@pytest.fixture(scope="session", autouse=True)
def cleanup_test_database():
    _remove_db_files()
    yield
    _remove_db_files()

