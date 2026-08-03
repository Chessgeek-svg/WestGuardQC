from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.qc_lot import QCLot


class QCResult(TimestampMixin, Base):
    """An individual QC measurement against a control lot.

    accepted is three-state: None means the result has not been evaluated
    yet, True/False is the evaluation outcome. westgard_violations holds the
    rule codes flagged by the engine; None mirrors the unevaluated state and
    an empty list means evaluated and in control.
    """

    __tablename__ = "qc_results"
    # id trails recorded_at so the index covers CHRONOLOGICAL ordering and the
    # dashboard's per-lot window function.
    __table_args__ = (Index("ix_qc_results_lot_recorded", "qc_lot_id", "recorded_at", "id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    qc_lot_id: Mapped[int] = mapped_column(ForeignKey("qc_lots.id"))
    value: Mapped[float]
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    recorded_by: Mapped[str] = mapped_column(String(100))
    accepted: Mapped[bool | None]
    westgard_violations: Mapped[list[str] | None] = mapped_column(JSONB)

    qc_lot: Mapped["QCLot"] = relationship(back_populates="results")

    def __repr__(self) -> str:
        return f"QCResult(id={self.id!r}, qc_lot_id={self.qc_lot_id!r}, value={self.value!r})"


# The order results are evaluated and displayed in. recorded_at alone is not
# enough: two results in the same second would come back in whatever order the
# planner chose, and rule evaluation would vary run to run. id breaks the tie by
# insertion, so the sequence is stable and reproducible.
CHRONOLOGICAL = (QCResult.recorded_at, QCResult.id)
