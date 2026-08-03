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


async def test_backdated_result_re_evaluates_the_results_after_it(client: AsyncClient) -> None:
    analyte_id = await make_analyte(client)
    lot_id = await make_lot(client, analyte_id)  # mean 100, sd 5

    later = await post_result(client, lot_id, 111.0, "2026-07-08T09:00:00Z")  # +2.2 SD
    assert later.json()["westgard_violations"] == ["1-2s"]

    # Backdated in front of it. On its own the new result is only a warning,
    # but it hands the 09:00 result a prior beyond +2 SD, which makes a 2-2s.
    await post_result(client, lot_id, 112.0, "2026-07-08T08:00:00Z")  # +2.4 SD

    results = (await client.get(f"/api/v1/qc-lots/{lot_id}/results")).json()["results"]
    assert [r["value"] for r in results] == [112.0, 111.0]
    assert results[0]["westgard_violations"] == ["1-2s"]
    assert "2-2s" in results[1]["westgard_violations"]
    assert results[1]["status"] == "rejected"


async def test_results_sharing_a_timestamp_still_see_each_other(client: AsyncClient) -> None:
    analyte_id = await make_analyte(client)
    lot_id = await make_lot(client, analyte_id)

    same_time = "2026-07-08T08:00:00Z"
    await post_result(client, lot_id, 111.0, same_time)  # +2.2 SD
    second = await post_result(client, lot_id, 112.0, same_time)  # +2.4 SD

    # Ordering falls back to insertion, so the first result is in the second's
    # history rather than being excluded for sharing its timestamp.
    assert "2-2s" in second.json()["westgard_violations"]


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
    # Identity, so a reader can tell one lot from the next one of the same level.
    assert body["lot_number"] == "L1"
    assert body["expiration_date"] == "2027-01-01"
    assert body["active"] is True
    statuses = [(point["value"], point["status"]) for point in body["results"]]
    assert statuses == [(101.0, "in_control"), (116.0, "rejected")]


async def test_lot_results_respects_limit(client: AsyncClient) -> None:
    analyte_id = await make_analyte(client)
    lot_id = await make_lot(client, analyte_id)
    for hour in range(8, 13):
        await post_result(client, lot_id, 100.0, f"2026-07-08T{hour:02d}:00:00Z")
    response = await client.get(f"/api/v1/qc-lots/{lot_id}/results", params={"limit": 3})
    assert len(response.json()["results"]) == 3


async def test_lot_results_rejects_out_of_range_limits(client: AsyncClient) -> None:
    analyte_id = await make_analyte(client)
    lot_id = await make_lot(client, analyte_id)
    # A negative limit used to reach Postgres and fail there as a 500.
    for limit in (0, -1, 501):
        response = await client.get(f"/api/v1/qc-lots/{lot_id}/results", params={"limit": limit})
        assert response.status_code == 422, limit


async def test_lot_results_missing_lot_returns_404(client: AsyncClient) -> None:
    assert (await client.get("/api/v1/qc-lots/999/results")).status_code == 404
