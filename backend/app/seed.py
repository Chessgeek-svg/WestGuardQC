"""Populate the database with realistic demo data.

Run against an existing schema (`alembic upgrade head`) with:

    python -m app.seed

The data is generated from a fixed RNG seed, so it is reproducible, and it is
evaluated through the real Westgard engine (via evaluate_and_store) so the
stored statuses match what the app would compute for entered results. Running
it again resets the QC tables first, so it is safe to re-run.
"""

import asyncio
import random
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import async_session_factory
from app.models import Analyte, QCLot, QCResult
from app.services.qc_result import evaluate_and_store, reevaluate

# One result per day, oldest first, ending today.
_RUN_COUNT = 28
_RNG_SEED = 20260708


class LotSpec:
    def __init__(
        self,
        lot_number: str,
        level: str,
        target_mean: float,
        target_sd: float,
        *,
        pattern: str = "clean",
        active: bool = True,
        void_at: int | None = None,
    ) -> None:
        self.lot_number = lot_number
        self.level = level
        self.target_mean = target_mean
        self.target_sd = target_sd
        # "clean" = in control; "flagged_reject" = excursions mid-run and a 1-3s
        # at the latest run (so the lot currently reads rejected);
        # "flagged_warning" = a 1-3s mid-run and a 1-2s at the latest run (so it
        # currently reads warning); "empty" = no results (empty-card state).
        self.pattern = pattern
        self.active = active
        # Index of a run entered wrong and later voided, so the demo data covers
        # the voided state the way a real lot would carry one.
        self.void_at = void_at


class AnalyteSpec:
    def __init__(self, name: str, unit: str, lots: Sequence[LotSpec]) -> None:
        self.name = name
        self.unit = unit
        self.lots = lots


SPECS: list[AnalyteSpec] = [
    AnalyteSpec(
        "Glucose",
        "mg/dL",
        [
            LotSpec("GLU-1042", "Level 1", 95.0, 3.0, pattern="flagged_reject", void_at=25),
            LotSpec("GLU-1042", "Level 2", 250.0, 7.5, pattern="clean"),
        ],
    ),
    AnalyteSpec(
        "Sodium",
        "mmol/L",
        [
            LotSpec("NA-2211", "Level 1", 120.0, 2.0, pattern="flagged_warning"),
            LotSpec("NA-2211", "Level 2", 140.0, 2.5, pattern="clean"),
        ],
    ),
    AnalyteSpec(
        "Potassium",
        "mmol/L",
        [
            LotSpec("K-3308", "Level 1", 4.0, 0.12, pattern="clean"),
        ],
    ),
    AnalyteSpec(
        "Cholesterol",
        "mg/dL",
        [
            # A freshly opened lot that has not been run yet.
            LotSpec("CHOL-7788", "Level 1", 200.0, 6.0, pattern="empty"),
        ],
    ),
]


def _values_for(spec: LotSpec, rng: random.Random) -> list[float]:
    """Generate the run values for a lot in units (not SD)."""
    mean, sd = spec.target_mean, spec.target_sd
    # Mostly in control: noise within roughly +/-1.4 SD.
    values = [mean + rng.gauss(0, 0.7) * sd for _ in range(_RUN_COUNT)]
    if spec.pattern == "flagged_reject":
        values[9] = mean + 2.4 * sd  # a 1-2s warning mid-run
        values[16] = mean + 2.2 * sd  # first of a 2-2s pair
        values[17] = mean + 2.3 * sd  # second of the 2-2s pair (rejection)
        values[-1] = mean - 3.3 * sd  # a 1-3s rejection at the latest run
    elif spec.pattern == "flagged_warning":
        values[12] = mean + 3.2 * sd  # a 1-3s rejection mid-run
        values[-1] = mean + 2.3 * sd  # a 1-2s warning at the latest run
    if spec.void_at is not None:
        # A mistyped entry, far enough out to be obviously wrong on the chart
        # but not so far that it stretches the y-axis and flattens the SD bands.
        values[spec.void_at] = mean + 3.6 * sd
    return [round(v, 2) for v in values]


async def seed(session: AsyncSession) -> None:
    """Reset the QC tables and populate reproducible demo data (flush only)."""
    await session.execute(delete(QCResult))
    await session.execute(delete(QCLot))
    await session.execute(delete(Analyte))
    await session.flush()

    rng = random.Random(_RNG_SEED)
    start = datetime.now(UTC) - timedelta(days=_RUN_COUNT - 1)

    for analyte_spec in SPECS:
        analyte = Analyte(name=analyte_spec.name, unit=analyte_spec.unit)
        session.add(analyte)
        await session.flush()

        for lot_spec in analyte_spec.lots:
            lot = QCLot(
                analyte_id=analyte.id,
                lot_number=lot_spec.lot_number,
                manufacturer="BioRad",
                level=lot_spec.level,
                target_mean=lot_spec.target_mean,
                target_sd=lot_spec.target_sd,
                expiration_date=(datetime.now(UTC) + timedelta(days=180)).date(),
                active=lot_spec.active,
            )
            session.add(lot)
            await session.flush()

            if lot_spec.pattern == "empty":
                continue

            stored: list[QCResult] = []
            for day, value in enumerate(_values_for(lot_spec, rng)):
                result = QCResult(
                    qc_lot_id=lot.id,
                    value=value,
                    recorded_at=start + timedelta(days=day, hours=8),
                    recorded_by="demo.tech",
                )
                await evaluate_and_store(session, lot, result)
                stored.append(result)

            if lot_spec.void_at is not None:
                await _void(session, lot, stored[lot_spec.void_at])


async def _void(session: AsyncSession, lot: QCLot, result: QCResult) -> None:
    """Void a seeded result the same way the API does, rescore included.

    The runs after it were scored against a history containing the bad value,
    so they have to be re-judged without it.
    """
    result.voided_at = datetime.now(UTC)
    result.voided_by = "demo.supervisor"
    result.void_reason = "transcription error, value re-entered from the printout"
    await session.flush()
    await reevaluate(session, lot, start=(result.recorded_at, result.id))


async def _summary(session: AsyncSession) -> tuple[int, int, int, int]:
    analytes = await session.scalar(select(func.count()).select_from(Analyte)) or 0
    lots = await session.scalar(select(func.count()).select_from(QCLot)) or 0
    results = await session.scalar(select(func.count()).select_from(QCResult)) or 0
    rejected = (
        await session.scalar(
            select(func.count()).select_from(QCResult).where(QCResult.accepted.is_(False))
        )
        or 0
    )
    return analytes, lots, results, rejected


async def main() -> None:
    async with async_session_factory() as session:
        await seed(session)
        await session.commit()
        analytes, lots, results, rejected = await _summary(session)
    print(f"Seeded {analytes} analytes, {lots} lots, {results} results ({rejected} rejected).")


if __name__ == "__main__":
    asyncio.run(main())
