"""Westgard multi-rule QC evaluation.

Pure functions: callers supply the value, lot statistics, and prior results;
nothing here touches the database or mutates its inputs.

Conventions used throughout:
- History is ordered chronologically, oldest first, and contains only results
  recorded before the value under evaluation.
- Limits are exclusive. A result at exactly 2.0 SD does not trigger 1-2s,
  matching the "exceeds" wording of the rule definitions.
- All violated rules are reported, not just the first match. 1-2s is a
  warning that accompanies any rejection beyond 2 SD; the caller decides
  accept/reject semantics.
- Rules that need more history than is available simply do not fire.
"""

from collections.abc import Sequence
from enum import StrEnum

from app.models import QCLot, QCResult


class WestgardRule(StrEnum):
    """Rule codes as stored in QCResult.westgard_violations."""

    RULE_1_2S = "1-2s"
    RULE_1_3S = "1-3s"
    RULE_2_2S = "2-2s"
    RULE_R_4S = "R-4s"
    RULE_4_1S = "4-1s"
    RULE_10X = "10x"


def evaluate(
    value: float,
    mean: float,
    sd: float,
    history: Sequence[float] = (),
) -> list[WestgardRule]:
    """Evaluate a new QC value against the Westgard multi-rules.

    Returns the violated rules in definition order; an empty list means the
    result is in control.
    """
    if sd <= 0:
        raise ValueError(f"target SD must be positive, got {sd}")

    z_scores = [(v - mean) / sd for v in (*history, value)]
    z = z_scores[-1]
    violations: list[WestgardRule] = []

    if abs(z) > 2:
        violations.append(WestgardRule.RULE_1_2S)
    if abs(z) > 3:
        violations.append(WestgardRule.RULE_1_3S)
    if _consecutive_beyond(z_scores, count=2, limit=2):
        violations.append(WestgardRule.RULE_2_2S)
    if _opposite_excursion(z_scores, limit=2):
        violations.append(WestgardRule.RULE_R_4S)
    if _consecutive_beyond(z_scores, count=4, limit=1):
        violations.append(WestgardRule.RULE_4_1S)
    if _consecutive_beyond(z_scores, count=10, limit=0):
        violations.append(WestgardRule.RULE_10X)

    return violations


def evaluate_result(
    result: QCResult,
    lot: QCLot,
    history: Sequence[QCResult] = (),
) -> list[WestgardRule]:
    """Evaluate a QCResult against its lot, given prior results oldest-first."""
    return evaluate(
        value=result.value,
        mean=lot.target_mean,
        sd=lot.target_sd,
        history=[r.value for r in history],
    )


def _consecutive_beyond(z_scores: Sequence[float], count: int, limit: float) -> bool:
    """True if the last `count` z-scores all sit beyond `limit` on one side.

    With limit=0 this is the same-side-of-mean check used by 10x; a value
    exactly on the mean (or exactly on the limit) breaks the run.
    """
    if len(z_scores) < count:
        return False
    window = z_scores[-count:]
    return all(z > limit for z in window) or all(z < -limit for z in window)


def _opposite_excursion(z_scores: Sequence[float], limit: float) -> bool:
    """True if the last two z-scores exceed `limit` on opposite sides.

    This is R-4s with limit=2: consecutive results spanning more than a
    4 SD range. Two results far apart but on the same side do not count.
    """
    if len(z_scores) < 2:
        return False
    prev, curr = z_scores[-2], z_scores[-1]
    return (prev > limit and curr < -limit) or (prev < -limit and curr > limit)
