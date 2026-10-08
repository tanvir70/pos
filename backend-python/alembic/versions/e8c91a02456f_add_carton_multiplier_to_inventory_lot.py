"""add_carton_multiplier_to_inventory_lot

Revision ID: e8c91a02456f
Revises: d7b69b03676b
Create Date: 2026-10-09 02:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e8c91a02456f'
down_revision: Union[str, Sequence[str], None] = 'd7b69b03676b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('inventory_lot', schema=None) as batch_op:
        batch_op.add_column(sa.Column('carton_multiplier', sa.Numeric(precision=10, scale=3), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('inventory_lot', schema=None) as batch_op:
        batch_op.drop_column('carton_multiplier')
