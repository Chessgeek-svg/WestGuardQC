"""Database-backed tests for the QC models.

Tests use flush (not commit) so the session-scoped schema stays empty between
tests and the conftest rollback keeps them isolated.
"""

from datetime import UTC, date, datetime

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Analyte, QCLot, QCResult


async def make_analyte(session: AsyncSession, name: str = "Glucose") -> Analyte:
    analyte = Analyte(name=name, unit="mg/dL")
    session.add(analyte)
    await session.flush()
    return analyte


async def make_lot(session: AsyncSession, analyte: Analyte, level: str = "Level 1") -> QCLot:
    lot = QCLot(
        analyte_id=analyte.id,
        lot_number="LOT-001",
        manufacturer="BioRad",
        level=level,
        target_mean=100.0,
        target_sd=5.0,
        expiration_date=date(2027, 1, 1),
    )
    session.add(lot)
    await session.flush()
    return lot


class TestAnalyte:
    async def test_persists_and_defaults_timestamps(self, session: AsyncSession) -> None:
        analyte = await make_analyte(session)
        assert analyte.id is not None
        assert analyte.created_at is not None
        assert analyte.updated_at is not None

    async def test_name_is_unique(self, session: AsyncSession) -> None:
        await make_analyte(session, name="Sodium")
        session.add(Analyte(name="Sodium", unit="mmol/L"))
        with pytest.raises(IntegrityError):
            await session.flush()


class TestQCLot:
    async def test_active_defaults_to_true(self, session: AsyncSession) -> None:
        analyte = await make_analyte(session)
        lot = await make_lot(session, analyte)
        await session.refresh(lot)
        assert lot.active is True

    async def test_relationship_to_analyte(self, session: AsyncSession) -> None:
        analyte = await make_analyte(session)
        lot = await make_lot(session, analyte)
        assert lot.analyte is analyte
        await session.refresh(analyte, ["qc_lots"])
        assert lot in analyte.qc_lots

    async def test_same_lot_number_allowed_across_levels(self, session: AsyncSession) -> None:
        analyte = await make_analyte(session)
        await make_lot(session, analyte, level="Level 1")
        await make_lot(session, analyte, level="Level 2")  # no error

    async def test_duplicate_analyte_lot_level_rejected(self, session: AsyncSession) -> None:
        analyte = await make_analyte(session)
        await make_lot(session, analyte, level="Level 1")
        duplicate = QCLot(
            analyte_id=analyte.id,
            lot_number="LOT-001",
            manufacturer="BioRad",
            level="Level 1",
            target_mean=100.0,
            target_sd=5.0,
            expiration_date=date(2027, 1, 1),
        )
        session.add(duplicate)
        with pytest.raises(IntegrityError):
            await session.flush()

    async def test_non_positive_sd_rejected(self, session: AsyncSession) -> None:
        analyte = await make_analyte(session)
        session.add(
            QCLot(
                analyte_id=analyte.id,
                lot_number="LOT-002",
                manufacturer="BioRad",
                level="Level 1",
                target_mean=100.0,
                target_sd=0.0,
                expiration_date=date(2027, 1, 1),
            )
        )
        with pytest.raises(IntegrityError):
            await session.flush()


class TestQCResult:
    async def test_accepted_and_violations_default_to_null(self, session: AsyncSession) -> None:
        analyte = await make_analyte(session)
        lot = await make_lot(session, analyte)
        result = QCResult(
            qc_lot_id=lot.id,
            value=101.0,
            recorded_at=datetime(2026, 7, 6, 8, 0, tzinfo=UTC),
            recorded_by="tech1",
        )
        session.add(result)
        await session.flush()
        assert result.accepted is None
        assert result.westgard_violations is None

    async def test_stores_violation_codes_as_json(self, session: AsyncSession) -> None:
        analyte = await make_analyte(session)
        lot = await make_lot(session, analyte)
        result = QCResult(
            qc_lot_id=lot.id,
            value=116.0,
            recorded_at=datetime(2026, 7, 6, 8, 0, tzinfo=UTC),
            recorded_by="tech1",
            accepted=False,
            westgard_violations=["1-2s", "1-3s"],
        )
        session.add(result)
        await session.flush()
        await session.refresh(result)

        assert result.westgard_violations == ["1-2s", "1-3s"]
        assert result.accepted is False

    async def test_results_relationship_ordered_by_recorded_at(self, session: AsyncSession) -> None:
        analyte = await make_analyte(session)
        lot = await make_lot(session, analyte)
        for hour in (10, 8, 9):
            session.add(
                QCResult(
                    qc_lot_id=lot.id,
                    value=100.0,
                    recorded_at=datetime(2026, 7, 6, hour, 0, tzinfo=UTC),
                    recorded_by="tech1",
                )
            )
        await session.flush()

        stmt = select(QCLot).where(QCLot.id == lot.id)
        loaded = (await session.scalars(stmt)).one()
        await session.refresh(loaded, ["results"])
        recorded_hours = [r.recorded_at.hour for r in loaded.results]
        assert recorded_hours == [8, 9, 10]
