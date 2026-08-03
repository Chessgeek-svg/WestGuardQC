from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class QCLotBase(BaseModel):
    lot_number: str = Field(min_length=1, max_length=50)
    manufacturer: str = Field(min_length=1, max_length=100)
    level: str = Field(min_length=1, max_length=50)
    target_mean: float
    target_sd: float = Field(gt=0)
    expiration_date: date


class QCLotCreate(QCLotBase):
    analyte_id: int
    active: bool = True


class QCLotUpdate(BaseModel):
    """Revisable fields on an existing lot.

    analyte_id, lot_number, and level are omitted: they identify the lot and
    form its unique constraint, so changing them would make it a different lot.
    Revising target_mean or target_sd rescores the lot's whole history, since
    every z-score is measured against them.
    """

    manufacturer: str | None = Field(default=None, min_length=1, max_length=100)
    target_mean: float | None = None
    target_sd: float | None = Field(default=None, gt=0)
    expiration_date: date | None = None
    active: bool | None = None


class QCLotRead(QCLotBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    analyte_id: int
    active: bool
    created_at: datetime
    updated_at: datetime
