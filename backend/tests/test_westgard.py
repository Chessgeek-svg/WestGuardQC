"""Unit tests for the Westgard rule engine.

All tests use a lot with mean 100 and SD 5, expressing inputs as SD offsets
from the mean so each case reads directly against the rule definitions.
History is chronological, oldest first.
"""

import pytest

from app.engine.westgard import WestgardRule, evaluate, evaluate_result
from app.models import QCLot, QCResult

MEAN = 100.0
SD = 5.0


def at(offset: float) -> float:
    """Value at the given number of SDs from the mean."""
    return MEAN + offset * SD


def run(offset: float, history_offsets: list[float] | None = None) -> list[WestgardRule]:
    history = [at(o) for o in history_offsets] if history_offsets else []
    return evaluate(value=at(offset), mean=MEAN, sd=SD, history=history)


class TestRule12s:
    def test_flags_beyond_plus_2sd(self) -> None:
        assert run(2.5) == [WestgardRule.RULE_1_2S]

    def test_flags_beyond_minus_2sd(self) -> None:
        assert run(-2.5) == [WestgardRule.RULE_1_2S]

    def test_within_2sd_is_in_control(self) -> None:
        assert run(1.9) == []


class TestRule13s:
    def test_flags_beyond_plus_3sd(self) -> None:
        assert run(3.5) == [WestgardRule.RULE_1_2S, WestgardRule.RULE_1_3S]

    def test_flags_beyond_minus_3sd(self) -> None:
        assert run(-3.5) == [WestgardRule.RULE_1_2S, WestgardRule.RULE_1_3S]

    def test_between_2_and_3sd_is_only_a_warning(self) -> None:
        assert WestgardRule.RULE_1_3S not in run(2.9)


class TestRule22s:
    def test_two_consecutive_above_plus_2sd(self) -> None:
        assert WestgardRule.RULE_2_2S in run(2.3, history_offsets=[2.5])

    def test_two_consecutive_below_minus_2sd(self) -> None:
        assert WestgardRule.RULE_2_2S in run(-2.3, history_offsets=[-2.5])

    def test_opposite_sides_do_not_count(self) -> None:
        assert WestgardRule.RULE_2_2S not in run(2.5, history_offsets=[-2.5])

    def test_prior_result_within_2sd_does_not_count(self) -> None:
        assert WestgardRule.RULE_2_2S not in run(2.5, history_offsets=[1.9])


class TestRuleR4s:
    def test_high_then_low_excursion(self) -> None:
        assert WestgardRule.RULE_R_4S in run(-2.2, history_offsets=[2.5])

    def test_low_then_high_excursion(self) -> None:
        assert WestgardRule.RULE_R_4S in run(2.2, history_offsets=[-2.5])

    def test_same_side_never_counts_even_if_far_apart(self) -> None:
        assert WestgardRule.RULE_R_4S not in run(2.1, history_offsets=[2.4])

    def test_span_above_4sd_but_neither_beyond_2sd_does_not_count(self) -> None:
        # A 4.1 SD span with only one side beyond the 2 SD limit.
        assert WestgardRule.RULE_R_4S not in run(-1.6, history_offsets=[2.5])


class TestRule41s:
    def test_four_consecutive_above_plus_1sd(self) -> None:
        assert run(1.3, history_offsets=[1.5, 1.2, 1.1]) == [WestgardRule.RULE_4_1S]

    def test_four_consecutive_below_minus_1sd(self) -> None:
        assert run(-1.3, history_offsets=[-1.5, -1.2, -1.1]) == [WestgardRule.RULE_4_1S]

    def test_three_consecutive_is_not_enough(self) -> None:
        assert run(1.3, history_offsets=[1.5, 1.2]) == []

    def test_one_result_within_1sd_breaks_the_run(self) -> None:
        assert run(1.3, history_offsets=[1.5, 0.9, 1.1]) == []


class TestRule10x:
    def test_ten_consecutive_above_the_mean(self) -> None:
        assert run(0.4, history_offsets=[0.5, 0.3, 0.6, 0.2, 0.7, 0.4, 0.5, 0.3, 0.6]) == [
            WestgardRule.RULE_10X
        ]

    def test_ten_consecutive_below_the_mean(self) -> None:
        offsets = [-0.5, -0.3, -0.6, -0.2, -0.7, -0.4, -0.5, -0.3, -0.6]
        assert run(-0.4, history_offsets=offsets) == [WestgardRule.RULE_10X]

    def test_one_result_on_the_other_side_breaks_the_run(self) -> None:
        assert run(0.4, history_offsets=[0.5, 0.3, 0.6, -0.2, 0.7, 0.4, 0.5, 0.3, 0.6]) == []

    def test_only_the_last_ten_results_matter(self) -> None:
        # Older out-of-pattern history does not prevent the rule firing.
        offsets = [-0.5, 0.5, 0.3, 0.6, 0.2, 0.7, 0.4, 0.5, 0.3, 0.6]
        assert run(0.4, history_offsets=offsets) == [WestgardRule.RULE_10X]


class TestEvaluateResult:
    def test_adapts_orm_instances_without_a_session(self) -> None:
        lot = QCLot(target_mean=MEAN, target_sd=SD)
        history = [QCResult(value=at(2.5))]
        result = QCResult(value=at(2.3))

        assert evaluate_result(result, lot, history) == [
            WestgardRule.RULE_1_2S,
            WestgardRule.RULE_2_2S,
        ]

    def test_rejects_non_positive_sd(self) -> None:
        lot = QCLot(target_mean=MEAN, target_sd=0.0)
        with pytest.raises(ValueError, match="target SD must be positive"):
            evaluate_result(QCResult(value=MEAN), lot)


class TestInControl:
    def test_result_near_the_mean_with_no_history(self) -> None:
        assert run(0.5) == []

    def test_result_near_the_mean_with_unremarkable_history(self) -> None:
        assert run(0.5, history_offsets=[1.5, -1.0, 0.3]) == []
