"""add idempotency_keys table

Revision ID: 20251222_add_idempotency
Revises: 
Create Date: 2025-12-22
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20251222_add_idempotency"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "idempotency_keys",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("key", sa.String(length=255), nullable=False, unique=True, index=True),
        sa.Column("created_at", sa.DateTime(), nullable=True, index=True),
        sa.Column("expires_at", sa.DateTime(), nullable=True, index=True),
    )


def downgrade():
    op.drop_table("idempotency_keys")
