from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Analyte, QCLot, QCResult
from app.seed import seed


async def test_seed_populates_varied_demo_data(session: AsyncSession) -> None:
    await seed(session)

    analytes = await session.scalar(select(func.count()).select_from(Analyte))
    lots = await session.scalar(select(func.count()).select_from(QCLot))
    results = await session.scalar(select(func.count()).select_from(QCResult))
    assert analytes and analytes >= 3
    assert lots and lots >= 4
    assert results and results > 0

    # The demo data is meant to exercise every verdict color.
    rejected = await session.scalar(
        select(func.count()).select_from(QCResult).where(QCResult.accepted.is_(False))
    )
    assert rejected and rejected > 0


async def test_seed_leaves_one_lot_empty(session: AsyncSession) -> None:
    await seed(session)

    lot_ids = list(await session.scalars(select(QCLot.id)))
    lots_with_results = set(await session.scalars(select(QCResult.qc_lot_id).distinct()))
    empty_lots = [lot_id for lot_id in lot_ids if lot_id not in lots_with_results]
    assert len(empty_lots) >= 1


async def test_seed_is_repeatable(session: AsyncSession) -> None:
    await seed(session)
    first = await session.scalar(select(func.count()).select_from(QCResult))
    await seed(session)
    second = await session.scalar(select(func.count()).select_from(QCResult))
    assert first == second
