from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.deps import SessionDep
from app.models import Analyte
from app.schemas import AnalyteCreate, AnalyteRead

router = APIRouter(prefix="/analytes", tags=["analytes"])


@router.post("", response_model=AnalyteRead, status_code=status.HTTP_201_CREATED)
async def create_analyte(data: AnalyteCreate, session: SessionDep) -> Analyte:
    analyte = Analyte(name=data.name, unit=data.unit)
    session.add(analyte)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"analyte {data.name!r} already exists"
        ) from exc
    await session.refresh(analyte)
    return analyte


@router.get("", response_model=list[AnalyteRead])
async def list_analytes(session: SessionDep) -> list[Analyte]:
    result = await session.scalars(select(Analyte).order_by(Analyte.name))
    return list(result)


@router.get("/{analyte_id}", response_model=AnalyteRead)
async def get_analyte(analyte_id: int, session: SessionDep) -> Analyte:
    analyte = await session.get(Analyte, analyte_id)
    if analyte is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "analyte not found")
    return analyte
