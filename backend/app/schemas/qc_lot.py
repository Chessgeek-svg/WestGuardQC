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


class QCLotRead(QCLotBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    analyte_id: int
    active: bool
    created_at: datetime
    updated_at: datetime
