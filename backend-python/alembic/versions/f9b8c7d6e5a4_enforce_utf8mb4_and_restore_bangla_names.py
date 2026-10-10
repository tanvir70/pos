"""enforce_utf8mb4_and_restore_bangla_names

Revision ID: f9b8c7d6e5a4
Revises: e8c91a02456f
Create Date: 2026-10-11 00:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from app.scripts.fix_utf8_bangla import run_utf8_bangla_migration_sync

# revision identifiers, used by Alembic.
revision: str = 'f9b8c7d6e5a4'
down_revision: Union[str, Sequence[str], None] = 'e8c91a02456f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema to utf8mb4 and restore corrupted Bengali names."""
    bind = op.get_bind()
    run_utf8_bangla_migration_sync(bind)


def downgrade() -> None:
    """Downgrade schema."""
    pass
