from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AnalyteBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    unit: str = Field(min_length=1, max_length=20)


class AnalyteCreate(AnalyteBase):
    pass


class AnalyteRead(AnalyteBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
