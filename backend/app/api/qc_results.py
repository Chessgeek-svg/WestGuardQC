from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import SessionDep
from app.models import QCLot, QCResult
from app.schemas import LotResults, QCResultCreate, QCResultRead
from app.services.qc_result import evaluate_and_store

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


@router.get("/qc-lots/{lot_id}/results", response_model=LotResults)
async def get_lot_results(lot_id: int, session: SessionDep, limit: int = 50) -> LotResults:
    lot = await session.scalar(
        select(QCLot).options(selectinload(QCLot.analyte)).where(QCLot.id == lot_id)
    )
    if lot is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "QC lot not found")

    stmt = (
        select(QCResult)
        .where(QCResult.qc_lot_id == lot_id)
        .order_by(QCResult.recorded_at.desc())
        .limit(limit)
    )
    newest_first = list(await session.scalars(stmt))
    newest_first.reverse()

    return LotResults(
        lot_id=lot.id,
        analyte_name=lot.analyte.name,
        unit=lot.analyte.unit,
        level=lot.level,
        target_mean=lot.target_mean,
        target_sd=lot.target_sd,
        results=[QCResultRead.model_validate(r) for r in newest_first],
    )
