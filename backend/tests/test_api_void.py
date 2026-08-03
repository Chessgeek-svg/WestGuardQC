"""Voiding a QC result.

A voided result stays in the table for the record but stops counting: it is
excluded from rule evaluation, and every result after it is rescored without
it. Lots here are mean 100, SD 5, so 111.0 is +2.2 SD and 112.0 is +2.4 SD.
"""

from httpx import AsyncClient

from tests.api_helpers import lot_results, make_analyte, make_lot, post_result, void_result


async def test_void_records_who_and_why(client: AsyncClient) -> None:
    analyte_id = await make_analyte(client)
    lot_id = await make_lot(client, analyte_id)
    created = await post_result(client, lot_id, 101.0, "2026-07-08T08:00:00Z")

    response = await void_result(client, created.json()["id"], reason="wrong tube")
    assert response.status_code == 200
    body = response.json()
    assert body["voided_at"] is not None
    assert body["voided_by"] == "supervisor"
    assert body["void_reason"] == "wrong tube"
    assert body["status"] == "voided"


async def test_voided_result_stays_in_the_lot_history(client: AsyncClient) -> None:
    analyte_id = await make_analyte(client)
    lot_id = await make_lot(client, analyte_id)
    created = await post_result(client, lot_id, 101.0, "2026-07-08T08:00:00Z")
    await void_result(client, created.json()["id"])

    results = await lot_results(client, lot_id)
    assert [r["status"] for r in results] == ["voided"]


async def test_voiding_rescores_the_results_after_it(client: AsyncClient) -> None:
    analyte_id = await make_analyte(client)
    lot_id = await make_lot(client, analyte_id)
    first = await post_result(client, lot_id, 111.0, "2026-07-08T08:00:00Z")
    second = await post_result(client, lot_id, 112.0, "2026-07-08T09:00:00Z")
    assert "2-2s" in second.json()["westgard_violations"]

    # Withdrawing the first of the pair leaves the second without a prior
    # beyond 2 SD, so its 2-2s no longer holds.
    await void_result(client, first.json()["id"])

    results = await lot_results(client, lot_id)
    surviving = next(r for r in results if r["id"] == second.json()["id"])
    assert surviving["westgard_violations"] == ["1-2s"]
    assert surviving["status"] == "warning"


async def test_voided_result_is_excluded_from_later_history(client: AsyncClient) -> None:
    analyte_id = await make_analyte(client)
    lot_id = await make_lot(client, analyte_id)
    first = await post_result(client, lot_id, 111.0, "2026-07-08T08:00:00Z")
    await void_result(client, first.json()["id"])

    # The voided excursion must not pair with this one to make a 2-2s.
    later = await post_result(client, lot_id, 112.0, "2026-07-08T09:00:00Z")
    assert later.json()["westgard_violations"] == ["1-2s"]


async def test_voiding_is_not_repeatable(client: AsyncClient) -> None:
    analyte_id = await make_analyte(client)
    lot_id = await make_lot(client, analyte_id)
    created = await post_result(client, lot_id, 101.0, "2026-07-08T08:00:00Z")
    result_id = created.json()["id"]

    assert (await void_result(client, result_id)).status_code == 200
    assert (await void_result(client, result_id)).status_code == 409


async def test_void_requires_a_reason_and_a_name(client: AsyncClient) -> None:
    analyte_id = await make_analyte(client)
    lot_id = await make_lot(client, analyte_id)
    created = await post_result(client, lot_id, 101.0, "2026-07-08T08:00:00Z")
    result_id = created.json()["id"]

    for payload in ({"voided_by": "supervisor", "void_reason": ""}, {"voided_by": "supervisor"}):
        response = await client.post(f"/api/v1/qc-results/{result_id}/void", json=payload)
        assert response.status_code == 422, payload


async def test_void_missing_result_returns_404(client: AsyncClient) -> None:
    assert (await void_result(client, 999)).status_code == 404
