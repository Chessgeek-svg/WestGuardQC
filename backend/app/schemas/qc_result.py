from datetime import UTC, datetime

from pydantic import BaseModel, ConfigDict, Field, computed_field

from app.engine.westgard import Verdict, verdict


class QCResultCreate(BaseModel):
    qc_lot_id: int
    value: float
    recorded_by: str = Field(min_length=1, max_length=100)
    recorded_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class QCResultRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    qc_lot_id: int
    value: float
    recorded_at: datetime
    recorded_by: str
    accepted: bool | None
    westgard_violations: list[str] | None
    created_at: datetime
    updated_at: datetime

    @computed_field  # type: ignore[prop-decorator]
    @property
    def status(self) -> Verdict:
        return verdict(self.westgard_violations)


class LotResults(BaseModel):
    """A lot's target statistics plus its recent results, oldest first.

    This is the single payload the Levey-Jennings chart consumes: the target
    mean and SD give the reference lines, and each point carries its verdict.
    """

    lot_id: int
    analyte_name: str
    unit: str
    level: str
    target_mean: float
    target_sd: float
    results: list[QCResultRead]
