from typing import TYPE_CHECKING

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.qc_lot import QCLot


class Analyte(TimestampMixin, Base):
    """A measurand tracked by the laboratory, e.g. Glucose or Potassium."""

    __tablename__ = "analytes"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    unit: Mapped[str] = mapped_column(String(20))

    qc_lots: Mapped[list["QCLot"]] = relationship(back_populates="analyte")

    def __repr__(self) -> str:
        return f"Analyte(id={self.id!r}, name={self.name!r}, unit={self.unit!r})"
