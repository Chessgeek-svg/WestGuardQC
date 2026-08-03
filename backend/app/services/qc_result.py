from collections import deque
from collections.abc import Sequence

from sqlalchemy import select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession

from app.engine.westgard import evaluate_result, is_rejected
from app.models import CHRONOLOGICAL, QCLot, QCResult

# 10x needs the current result plus nine priors, which is the deepest any rule
# looks back. Fetching nine prior results covers every rule.
_HISTORY_DEPTH = 9


async def evaluate_and_store(session: AsyncSession, lot: QCLot, data: QCResult) -> QCResult:
    """Store a new result and (re)evaluate it along with everything after it.

    `data` is an unsaved QCResult carrying value, recorded_at, and recorded_by.

    A result is judged against the results that precede it in time, not the
    ones that happened to be entered first. That means an entry backdated into
    the middle of a run changes the history of every result after it, so those
    have to be re-evaluated too or their stored verdicts go stale. Appending a
    result to the end of a run, which is the normal case, leaves nothing after
    it and costs one extra empty query.
    """
    # Serialize evaluation per lot. Without this, two concurrent writes both
    # read the same history and each scores as though it were alone, so a 2-2s
    # spanning the pair would be missed.
    await session.execute(select(QCLot.id).where(QCLot.id == lot.id).with_for_update())

    session.add(data)
    await session.flush()  # assigns data.id, which the ordering below needs

    history = await _history_before(session, lot, data)
    window: deque[QCResult] = deque(history, maxlen=_HISTORY_DEPTH)
    for result in await _from(session, lot, data):
        violations = evaluate_result(result, lot, window)
        result.westgard_violations = [v.value for v in violations]
        result.accepted = not is_rejected(violations)
        window.append(result)

    await session.flush()
    return data


async def _history_before(
    session: AsyncSession, lot: QCLot, result: QCResult
) -> Sequence[QCResult]:
    """The results immediately preceding `result`, oldest first."""
    stmt = (
        select(QCResult)
        .where(
            QCResult.qc_lot_id == lot.id,
            tuple_(*CHRONOLOGICAL) < (result.recorded_at, result.id),
        )
        .order_by(*(column.desc() for column in CHRONOLOGICAL))
        .limit(_HISTORY_DEPTH)
    )
    newest_first = list(await session.scalars(stmt))
    newest_first.reverse()
    return newest_first


async def _from(session: AsyncSession, lot: QCLot, result: QCResult) -> Sequence[QCResult]:
    """`result` and every result after it, oldest first.

    The comparison is inclusive, so `result` is the first element and one loop
    covers both the new result and the tail it invalidated. Deeply backdating
    an entry can walk the whole lot; that is the cost of storing verdicts
    rather than deriving them on read.
    """
    stmt = (
        select(QCResult)
        .where(
            QCResult.qc_lot_id == lot.id,
            tuple_(*CHRONOLOGICAL) >= (result.recorded_at, result.id),
        )
        .order_by(*CHRONOLOGICAL)
    )
    return list(await session.scalars(stmt))
