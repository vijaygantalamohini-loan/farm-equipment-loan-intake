"""add documents_and_consents_data column

Revision ID: 6d7ccb38e70a
Revises: 20251222_add_idempotency
Create Date: 2025-12-28 18:29:53.970499
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '6d7ccb38e70a'
down_revision = '20251222_add_idempotency'
branch_labels = None
depends_on = None


def upgrade():
    # SQLite does not support ALTER COLUMN TYPE; keep as TEXT in dev.
    bind = op.get_bind()
    if bind.dialect.name != 'sqlite':
        op.alter_column(
            'loan_applications',
            'documents_and_consents_data',
            existing_type=sa.TEXT(),
            type_=sa.JSON(),
            existing_nullable=True,
        )


def downgrade():
    bind = op.get_bind()
    if bind.dialect.name != 'sqlite':
        op.alter_column(
            'loan_applications',
            'documents_and_consents_data',
            existing_type=sa.JSON(),
            type_=sa.TEXT(),
            existing_nullable=True,
        )
