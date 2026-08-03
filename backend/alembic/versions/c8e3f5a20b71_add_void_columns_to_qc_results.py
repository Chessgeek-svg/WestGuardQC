"""add void columns to qc_results

A mistyped or invalid QC result is withdrawn rather than deleted, so the record
of what was run and why it was discounted survives. All three columns are
nullable, so existing rows need no backfill: a null voided_at means live.

Revision ID: c8e3f5a20b71
Revises: b2c7a91e5d34
Create Date: 2026-08-03 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c8e3f5a20b71"
down_revision: str | Sequence[str] | None = "b2c7a91e5d34"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("qc_results", sa.Column("voided_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("qc_results", sa.Column("voided_by", sa.String(length=100), nullable=True))
    op.add_column("qc_results", sa.Column("void_reason", sa.String(length=500), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("qc_results", "void_reason")
    op.drop_column("qc_results", "voided_by")
    op.drop_column("qc_results", "voided_at")
