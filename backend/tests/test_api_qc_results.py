from httpx import AsyncClient

from tests.api_helpers import make_analyte, make_lot, post_result


async def test_in_control_result_is_accepted(client: AsyncClient) -> None:
    analyte_id = await make_analyte(client)
    lot_id = await make_lot(client, analyte_id)
    response = await post_result(client, lot_id, 101.0, "2026-07-08T08:00:00Z")
    assert response.status_code == 201
    body = response.json()
    assert body["accepted"] is True
    assert body["westgard_violations"] == []
    assert body["status"] == "in_control"


async def test_1_3s_result_is_rejected(client: AsyncClient) -> None:
    analyte_id = await make_analyte(client)
    lot_id = await make_lot(client, analyte_id)  # mean 100, sd 5
    response = await post_result(client, lot_id, 116.0, "2026-07-08T08:00:00Z")  # +3.2 SD
    body = response.json()
    assert body["accepted"] is False
    assert "1-3s" in body["westgard_violations"]
    assert body["status"] == "rejected"


async def test_warning_only_result_is_accepted(client: AsyncClient) -> None:
    analyte_id = await make_analyte(client)
    lot_id = await make_lot(client, analyte_id)
    response = await post_result(client, lot_id, 111.0, "2026-07-08T08:00:00Z")  # +2.2 SD
    body = response.json()
    assert body["westgard_violations"] == ["1-2s"]
    assert body["accepted"] is True
    assert body["status"] == "warning"


async def test_history_triggers_2_2s_on_second_result(client: AsyncClient) -> None:
    analyte_id = await make_analyte(client)
    lot_id = await make_lot(client, analyte_id)
    await post_result(client, lot_id, 111.0, "2026-07-08T08:00:00Z")  # +2.2 SD
    second = await post_result(client, lot_id, 112.0, "2026-07-08T09:00:00Z")  # +2.4 SD
    body = second.json()
    assert "2-2s" in body["westgard_violations"]
    assert body["status"] == "rejected"


async def test_history_is_ordered_by_recorded_at_not_insertion(client: AsyncClient) -> None:
    analyte_id = await make_analyte(client)
    lot_id = await make_lot(client, analyte_id)
    # Insert the later timestamp first, then a backdated in-control result.
    await post_result(client, lot_id, 112.0, "2026-07-08T09:00:00Z")
    backdated = await post_result(client, lot_id, 111.0, "2026-07-08T08:00:00Z")
    # The backdated result has no prior history, so only 1-2s, no 2-2s.
    assert backdated.json()["westgard_violations"] == ["1-2s"]


async def test_post_to_missing_lot_returns_404(client: AsyncClient) -> None:
    response = await post_result(client, 999, 100.0, "2026-07-08T08:00:00Z")
    assert response.status_code == 404


async def test_get_result_by_id(client: AsyncClient) -> None:
    analyte_id = await make_analyte(client)
    lot_id = await make_lot(client, analyte_id)
    created = await post_result(client, lot_id, 116.0, "2026-07-08T08:00:00Z")
    result_id = created.json()["id"]
    fetched = await client.get(f"/api/v1/qc-results/{result_id}")
    assert fetched.status_code == 200
    assert fetched.json()["status"] == "rejected"
    assert (await client.get("/api/v1/qc-results/999")).status_code == 404


async def test_lot_results_endpoint_returns_stats_and_ordered_points(
    client: AsyncClient,
) -> None:
    analyte_id = await make_analyte(client)
    lot_id = await make_lot(client, analyte_id)
    await post_result(client, lot_id, 116.0, "2026-07-08T09:00:00Z")
    await post_result(client, lot_id, 101.0, "2026-07-08T08:00:00Z")

    response = await client.get(f"/api/v1/qc-lots/{lot_id}/results")
    assert response.status_code == 200
    body = response.json()
    assert body["analyte_name"] == "Glucose"
    assert body["unit"] == "mg/dL"
    assert body["target_mean"] == 100.0
    assert body["target_sd"] == 5.0
    statuses = [(point["value"], point["status"]) for point in body["results"]]
    assert statuses == [(101.0, "in_control"), (116.0, "rejected")]


async def test_lot_results_respects_limit(client: AsyncClient) -> None:
    analyte_id = await make_analyte(client)
    lot_id = await make_lot(client, analyte_id)
    for hour in range(8, 13):
        await post_result(client, lot_id, 100.0, f"2026-07-08T{hour:02d}:00:00Z")
    response = await client.get(f"/api/v1/qc-lots/{lot_id}/results", params={"limit": 3})
    assert len(response.json()["results"]) == 3


async def test_lot_results_missing_lot_returns_404(client: AsyncClient) -> None:
    assert (await client.get("/api/v1/qc-lots/999/results")).status_code == 404
