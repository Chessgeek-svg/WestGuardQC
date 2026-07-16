from httpx import AsyncClient

from tests.api_helpers import make_analyte, make_lot, post_result


async def test_returns_one_bundle_per_active_lot(client: AsyncClient) -> None:
    analyte_id = await make_analyte(client)
    await make_lot(client, analyte_id, lot_number="L1", level="Level 1")
    await make_lot(client, analyte_id, lot_number="L1", level="Level 2")

    response = await client.get("/api/v1/dashboard")
    assert response.status_code == 200
    assert len(response.json()) == 2


async def test_bundles_carry_target_stats_and_oldest_first_results(client: AsyncClient) -> None:
    analyte_id = await make_analyte(client)
    lot_id = await make_lot(client, analyte_id)
    await post_result(client, lot_id, 116.0, "2026-07-08T09:00:00Z")
    await post_result(client, lot_id, 101.0, "2026-07-08T08:00:00Z")

    bundle = (await client.get("/api/v1/dashboard")).json()[0]
    assert bundle["analyte_name"] == "Glucose"
    assert bundle["target_mean"] == 100.0
    values = [(r["value"], r["status"]) for r in bundle["results"]]
    assert values == [(101.0, "in_control"), (116.0, "rejected")]


async def test_lot_with_no_results_is_included_with_empty_list(client: AsyncClient) -> None:
    analyte_id = await make_analyte(client)
    await make_lot(client, analyte_id)

    bundle = (await client.get("/api/v1/dashboard")).json()[0]
    assert bundle["results"] == []


async def test_limit_caps_results_per_lot(client: AsyncClient) -> None:
    analyte_id = await make_analyte(client)
    lot_id = await make_lot(client, analyte_id)
    for hour in range(8, 14):
        await post_result(client, lot_id, 100.0, f"2026-07-08T{hour:02d}:00:00Z")

    bundle = (await client.get("/api/v1/dashboard", params={"limit": 3})).json()[0]
    assert len(bundle["results"]) == 3
    # The cap keeps the most recent, still oldest-first.
    hours = [r["recorded_at"][11:13] for r in bundle["results"]]
    assert hours == ["11", "12", "13"]


async def test_filters_by_analyte(client: AsyncClient) -> None:
    a1 = await make_analyte(client, name="Glucose")
    a2 = await make_analyte(client, name="Sodium")
    await make_lot(client, a1, lot_number="G1")
    await make_lot(client, a2, lot_number="S1")

    bundles = (await client.get("/api/v1/dashboard", params={"analyte_id": a1})).json()
    assert [b["analyte_name"] for b in bundles] == ["Glucose"]


async def test_excludes_inactive_lots(client: AsyncClient) -> None:
    analyte_id = await make_analyte(client)
    active_lot = await make_lot(client, analyte_id, lot_number="A1", level="Level 1")
    await client.post(
        "/api/v1/qc-lots",
        json={
            "analyte_id": analyte_id,
            "lot_number": "I1",
            "manufacturer": "BioRad",
            "level": "Level 2",
            "target_mean": 100.0,
            "target_sd": 5.0,
            "expiration_date": "2027-01-01",
            "active": False,
        },
    )

    bundles = (await client.get("/api/v1/dashboard")).json()
    assert [b["lot_id"] for b in bundles] == [active_lot]
