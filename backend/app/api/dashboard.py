from collections import defaultdict

from fastapi import APIRouter
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import SessionDep
from app.models import QCLot, QCResult
from app.schemas import LotResults, QCResultRead

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard", response_model=list[LotResults])
async def get_dashboard(
    session: SessionDep,
    analyte_id: int | None = None,
    limit: int = 30,
) -> list[LotResults]:
    """Active lots with their recent results, one bundle per lot.

    Powers the dashboard trackers: each lot's target stats plus up to `limit`
    recent results (oldest-first) so the frontend can draw a trend and compute
    observed statistics. Lots with no results are included with an empty list.
    """
    lots_stmt = select(QCLot).options(selectinload(QCLot.analyte)).where(QCLot.active.is_(True))
    if analyte_id is not None:
        lots_stmt = lots_stmt.where(QCLot.analyte_id == analyte_id)
    lots = list(await session.scalars(lots_stmt))
    if not lots:
        return []

    lot_ids = [lot.id for lot in lots]
    results_stmt = (
        select(QCResult)
        .where(QCResult.qc_lot_id.in_(lot_ids))
        .order_by(QCResult.qc_lot_id, QCResult.recorded_at.desc())
    )
    recent_by_lot: dict[int, list[QCResult]] = defaultdict(list)
    for result in await session.scalars(results_stmt):
        if len(recent_by_lot[result.qc_lot_id]) < limit:
            recent_by_lot[result.qc_lot_id].append(result)

    lots.sort(key=lambda lot: (lot.analyte.name, lot.level))
    return [
        LotResults(
            lot_id=lot.id,
            analyte_name=lot.analyte.name,
            unit=lot.analyte.unit,
            level=lot.level,
            target_mean=lot.target_mean,
            target_sd=lot.target_sd,
            results=[
                QCResultRead.model_validate(result) for result in reversed(recent_by_lot[lot.id])
            ],
        )
        for lot in lots
    ]
