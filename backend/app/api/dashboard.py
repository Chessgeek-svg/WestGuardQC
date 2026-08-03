from collections import defaultdict
from typing import Annotated

from fastapi import APIRouter, Query
from sqlalchemy import func, select
from sqlalchemy.orm import aliased, selectinload

from app.api.deps import SessionDep
from app.models import CHRONOLOGICAL, QCLot, QCResult
from app.schemas import LotResults, QCResultRead

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard", response_model=list[LotResults])
async def get_dashboard(
    session: SessionDep,
    analyte_id: int | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 30,
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

    # Rank each lot's results newest-first and keep the top `limit` per lot, so
    # Postgres discards the older rows instead of shipping every result for
    # every lot to be truncated here.
    ranked = (
        select(
            QCResult,
            func.row_number()
            .over(
                partition_by=QCResult.qc_lot_id,
                order_by=[column.desc() for column in CHRONOLOGICAL],
            )
            .label("rank"),
        )
        .where(QCResult.qc_lot_id.in_([lot.id for lot in lots]))
        .subquery()
    )
    # rank 1 is the newest, so descending rank hands back the kept rows
    # oldest-first without restating the sort key the window already applied.
    recent = aliased(QCResult, ranked)
    results_stmt = (
        select(recent)
        .where(ranked.c.rank <= limit)
        .order_by(ranked.c.qc_lot_id, ranked.c.rank.desc())
    )

    # Already oldest-first, which is the order the chart wants.
    recent_by_lot: dict[int, list[QCResult]] = defaultdict(list)
    for result in await session.scalars(results_stmt):
        recent_by_lot[result.qc_lot_id].append(result)

    lots.sort(key=lambda lot: (lot.analyte.name, lot.level))
    return [
        LotResults(
            lot_id=lot.id,
            lot_number=lot.lot_number,
            analyte_name=lot.analyte.name,
            unit=lot.analyte.unit,
            level=lot.level,
            target_mean=lot.target_mean,
            target_sd=lot.target_sd,
            expiration_date=lot.expiration_date,
            active=lot.active,
            results=[QCResultRead.model_validate(result) for result in recent_by_lot[lot.id]],
        )
        for lot in lots
    ]
