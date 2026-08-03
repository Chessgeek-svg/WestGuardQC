from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.deps import SessionDep
from app.models import Analyte, QCLot
from app.schemas import QCLotCreate, QCLotRead, QCLotUpdate
from app.services.qc_result import lock_lot, reevaluate

router = APIRouter(prefix="/qc-lots", tags=["qc-lots"])


@router.post("", response_model=QCLotRead, status_code=status.HTTP_201_CREATED)
async def create_qc_lot(data: QCLotCreate, session: SessionDep) -> QCLot:
    if await session.get(Analyte, data.analyte_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "analyte not found")

    lot = QCLot(**data.model_dump())
    session.add(lot)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "a lot with this number and level already exists for the analyte",
        ) from exc
    await session.refresh(lot)
    return lot


@router.get("", response_model=list[QCLotRead])
async def list_qc_lots(
    session: SessionDep,
    analyte_id: int | None = None,
    active: bool | None = None,
) -> list[QCLot]:
    stmt = select(QCLot).order_by(QCLot.analyte_id, QCLot.level)
    if analyte_id is not None:
        stmt = stmt.where(QCLot.analyte_id == analyte_id)
    if active is not None:
        stmt = stmt.where(QCLot.active == active)
    result = await session.scalars(stmt)
    return list(result)


@router.get("/{lot_id}", response_model=QCLotRead)
async def get_qc_lot(lot_id: int, session: SessionDep) -> QCLot:
    lot = await session.get(QCLot, lot_id)
    if lot is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "QC lot not found")
    return lot


@router.patch("/{lot_id}", response_model=QCLotRead)
async def update_qc_lot(lot_id: int, data: QCLotUpdate, session: SessionDep) -> QCLot:
    """Revise a lot's targets, expiry, or active state.

    Retiring a lot (active=False) drops it off the dashboard and needs no
    rescoring. Revising target_mean or target_sd moves every z-score in the
    lot, so all of its results are rescored against the new targets.
    """
    lot = await session.get(QCLot, lot_id)
    if lot is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "QC lot not found")

    changes = data.model_dump(exclude_unset=True)
    retargeted = any(field in changes for field in ("target_mean", "target_sd"))
    if retargeted:
        await lock_lot(session, lot)
    for field, value in changes.items():
        setattr(lot, field, value)
    await session.flush()

    if retargeted:
        # After the flush, so the rescore reads the new targets rather than
        # the ones the results were originally judged against.
        await reevaluate(session, lot)

    await session.commit()
    await session.refresh(lot)
    return lot
