from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, ForeignKey, String, UniqueConstraint, true
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.analyte import Analyte
    from app.models.qc_result import QCResult


class QCLot(TimestampMixin, Base):
    """A lot of control material with assigned target statistics.

    target_mean and target_sd define the Levey-Jennings limits and feed the
    Westgard rule engine. A lot is unique per analyte, lot number, and level:
    the same physical lot is typically assayed at multiple control levels.
    """

    __tablename__ = "qc_lots"
    __table_args__ = (
        UniqueConstraint("analyte_id", "lot_number", "level", name="uq_qc_lots_analyte_lot_level"),
        CheckConstraint("target_sd > 0", name="target_sd_positive"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    analyte_id: Mapped[int] = mapped_column(ForeignKey("analytes.id"), index=True)
    lot_number: Mapped[str] = mapped_column(String(50))
    manufacturer: Mapped[str] = mapped_column(String(100))
    level: Mapped[str] = mapped_column(String(50))
    target_mean: Mapped[float]
    target_sd: Mapped[float]
    expiration_date: Mapped[date]
    active: Mapped[bool] = mapped_column(default=True, server_default=true())

    analyte: Mapped["Analyte"] = relationship(back_populates="qc_lots")
    results: Mapped[list["QCResult"]] = relationship(
        back_populates="qc_lot", order_by="QCResult.recorded_at"
    )

    def __repr__(self) -> str:
        return f"QCLot(id={self.id!r}, lot_number={self.lot_number!r}, level={self.level!r})"
