from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import SessionDep
from app.models import CHRONOLOGICAL, QCLot, QCResult
from app.schemas import LotResults, QCResultCreate, QCResultRead, QCResultVoid
from app.services.qc_result import evaluate_and_store, lock_lot, reevaluate

router = APIRouter(tags=["qc-results"])


@router.post("/qc-results", response_model=QCResultRead, status_code=status.HTTP_201_CREATED)
async def create_qc_result(data: QCResultCreate, session: SessionDep) -> QCResult:
    lot = await session.get(QCLot, data.qc_lot_id)
    if lot is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "QC lot not found")

    result = QCResult(
        qc_lot_id=data.qc_lot_id,
        value=data.value,
        recorded_at=data.recorded_at,
        recorded_by=data.recorded_by,
    )
    await evaluate_and_store(session, lot, result)
    await session.commit()
    await session.refresh(result)
    return result


@router.get("/qc-results/{result_id}", response_model=QCResultRead)
async def get_qc_result(result_id: int, session: SessionDep) -> QCResult:
    result = await session.get(QCResult, result_id)
    if result is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "QC result not found")
    return result


@router.post("/qc-results/{result_id}/void", response_model=QCResultRead)
async def void_qc_result(result_id: int, data: QCResultVoid, session: SessionDep) -> QCResult:
    """Withdraw a result from evaluation without deleting it.

    A POST to a sub-resource rather than a DELETE, because the row stays: the
    lab record of what was run and why it was discounted is the point. Results
    after it are rescored, since their history no longer contains this one.
    """
    result = await session.get(QCResult, result_id)
    if result is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "QC result not found")
    if result.voided_at is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "QC result is already voided")

    lot = await session.get(QCLot, result.qc_lot_id)
    if lot is None:  # pragma: no cover - the foreign key makes this unreachable
        raise HTTPException(status.HTTP_404_NOT_FOUND, "QC lot not found")

    await lock_lot(session, lot)
    result.voided_at = datetime.now(UTC)
    result.voided_by = data.voided_by
    result.void_reason = data.void_reason
    await session.flush()

    await reevaluate(session, lot, start=(result.recorded_at, result.id))
    await session.commit()
    await session.refresh(result)
    return result


@router.get("/qc-lots/{lot_id}/results", response_model=LotResults)
async def get_lot_results(
    lot_id: int,
    session: SessionDep,
    limit: Annotated[int, Query(ge=1, le=500)] = 50,
) -> LotResults:
    lot = await session.scalar(
        select(QCLot).options(selectinload(QCLot.analyte)).where(QCLot.id == lot_id)
    )
    if lot is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "QC lot not found")

    stmt = (
        select(QCResult)
        .where(QCResult.qc_lot_id == lot_id)
        .order_by(*(column.desc() for column in CHRONOLOGICAL))
        .limit(limit)
    )
    newest_first = list(await session.scalars(stmt))
    newest_first.reverse()

    return LotResults(
        lot_id=lot.id,
        lot_number=lot.lot_number,
        analyte_name=lot.analyte.name,
        unit=lot.analyte.unit,
        level=lot.level,
        target_mean=lot.target_mean,
        target_sd=lot.target_sd,
        expiration_date=lot.expiration_date,
        active=lot.active,
        results=[QCResultRead.model_validate(r) for r in newest_first],
    )
