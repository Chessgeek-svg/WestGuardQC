"""widen qc_result index to cover the id tiebreak

Results are ordered by (recorded_at, id) so that results sharing a timestamp
have a stable sequence. Extending the index to match keeps the history lookup
and the dashboard's per-lot window function on an index-only path.

Revision ID: b2c7a91e5d34
Revises: f4d1beb6d812
Create Date: 2026-08-03 00:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b2c7a91e5d34"
down_revision: str | Sequence[str] | None = "f4d1beb6d812"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_index("ix_qc_results_lot_recorded", table_name="qc_results")
    op.create_index(
        "ix_qc_results_lot_recorded",
        "qc_results",
        ["qc_lot_id", "recorded_at", "id"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_qc_results_lot_recorded", table_name="qc_results")
    op.create_index(
        "ix_qc_results_lot_recorded",
        "qc_results",
        ["qc_lot_id", "recorded_at"],
        unique=False,
    )
