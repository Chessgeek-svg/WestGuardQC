from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.engine.westgard import evaluate_result, is_rejected
from app.models import QCLot, QCResult

# 10x needs the current result plus nine priors, which is the deepest any rule
# looks back. Fetching nine prior results covers every rule.
_HISTORY_DEPTH = 9


async def evaluate_and_store(session: AsyncSession, lot: QCLot, data: QCResult) -> QCResult:
    """Evaluate a new result against its lot's history and persist the verdict.

    `data` is an unsaved QCResult carrying value, recorded_at, and recorded_by.
    History is the lot's results recorded strictly before this one, so a
    backdated entry is judged against what preceded it in time, not what was
    entered before it.
    """
    history = await _recent_history(session, lot.id, data.recorded_at)
    violations = evaluate_result(data, lot, history)
    data.westgard_violations = [v.value for v in violations]
    data.accepted = not is_rejected(violations)
    session.add(data)
    await session.flush()
    return data


async def _recent_history(session: AsyncSession, lot_id: int, before: datetime) -> list[QCResult]:
    stmt = (
        select(QCResult)
        .where(QCResult.qc_lot_id == lot_id, QCResult.recorded_at < before)
        .order_by(QCResult.recorded_at.desc())
        .limit(_HISTORY_DEPTH)
    )
    newest_first = list(await session.scalars(stmt))
    newest_first.reverse()
    return newest_first
