from collections import deque
from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import Select, select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession

from app.engine.westgard import evaluate_result, is_rejected
from app.models import CHRONOLOGICAL, QCLot, QCResult

# 10x needs the current result plus nine priors, which is the deepest any rule
# looks back. Fetching nine prior results covers every rule.
_HISTORY_DEPTH = 9

# A position in a lot's timeline. id breaks ties between results sharing a
# timestamp, matching CHRONOLOGICAL.
Position = tuple[datetime, int]


async def evaluate_and_store(session: AsyncSession, lot: QCLot, data: QCResult) -> QCResult:
    """Store a new result and rescore it along with everything after it.

    `data` is an unsaved QCResult carrying value, recorded_at, and recorded_by.

    A result is judged against the results that precede it in time, not the
    ones that happened to be entered first. So an entry backdated into the
    middle of a run changes the history of every result after it, and those are
    rescored too. Appending to the end of a run, which is the normal case,
    finds nothing after it and costs one extra empty query.
    """
    await lock_lot(session, lot)
    session.add(data)
    await session.flush()  # assigns data.id, which the ordering below needs

    await reevaluate(session, lot, start=(data.recorded_at, data.id))
    return data


async def lock_lot(session: AsyncSession, lot: QCLot) -> None:
    """Serialize evaluation for one lot.

    Without this, two concurrent writes both read the same history and each
    scores as though it were alone, so a 2-2s spanning the pair is missed.
    """
    await session.execute(select(QCLot.id).where(QCLot.id == lot.id).with_for_update())


async def reevaluate(session: AsyncSession, lot: QCLot, *, start: Position | None = None) -> None:
    """Rescore a lot's results from `start` onward, or all of them if None.

    Callers pass a position when only part of the timeline is affected, as when
    a result is inserted or voided partway through a run. They pass None when
    every verdict is suspect, as when the lot's target mean or SD changes and
    every z-score moves with it.

    Voided results are neither rescored nor allowed into anyone's history.
    """
    history = await _history_before(session, lot, start) if start is not None else []
    window: deque[QCResult] = deque(history, maxlen=_HISTORY_DEPTH)

    for result in await _from(session, lot, start):
        violations = evaluate_result(result, lot, window)
        result.westgard_violations = [v.value for v in violations]
        result.accepted = not is_rejected(violations)
        window.append(result)

    await session.flush()


def _live_results(lot: QCLot) -> Select[tuple[QCResult]]:
    """A lot's results excluding voided ones, which no longer count."""
    return select(QCResult).where(
        QCResult.qc_lot_id == lot.id,
        QCResult.voided_at.is_(None),
    )


async def _history_before(session: AsyncSession, lot: QCLot, start: Position) -> Sequence[QCResult]:
    """The live results immediately preceding `start`, oldest first."""
    stmt = (
        _live_results(lot)
        .where(tuple_(*CHRONOLOGICAL) < start)
        .order_by(*(column.desc() for column in CHRONOLOGICAL))
        .limit(_HISTORY_DEPTH)
    )
    newest_first = list(await session.scalars(stmt))
    newest_first.reverse()
    return newest_first


async def _from(session: AsyncSession, lot: QCLot, start: Position | None) -> Sequence[QCResult]:
    """Every live result at or after `start`, oldest first, or all of them.

    The comparison is inclusive, so a freshly inserted result is the first
    element and one loop covers both it and the tail it invalidated. Deeply
    backdating an entry can walk the whole lot, which is the cost of storing
    verdicts rather than deriving them on read.
    """
    stmt = _live_results(lot).order_by(*CHRONOLOGICAL)
    if start is not None:
        stmt = stmt.where(tuple_(*CHRONOLOGICAL) >= start)
    return list(await session.scalars(stmt))
