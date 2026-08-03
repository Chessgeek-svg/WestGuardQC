from httpx import AsyncClient

from tests.api_helpers import make_analyte, make_lot, post_result, void_result


async def test_create_defaults_active_true(client: AsyncClient) -> None:
    analyte_id = await make_analyte(client)
    response = await client.post(
        "/api/v1/qc-lots",
        json={
            "analyte_id": analyte_id,
            "lot_number": "L1",
            "manufacturer": "BioRad",
            "level": "Level 1",
            "target_mean": 100.0,
            "target_sd": 5.0,
            "expiration_date": "2027-01-01",
        },
    )
    assert response.status_code == 201
    assert response.json()["active"] is True


async def test_create_with_missing_analyte_returns_404(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/qc-lots",
        json={
            "analyte_id": 999,
            "lot_number": "L1",
            "manufacturer": "BioRad",
            "level": "Level 1",
            "target_mean": 100.0,
            "target_sd": 5.0,
            "expiration_date": "2027-01-01",
        },
    )
    assert response.status_code == 404


async def test_non_positive_sd_rejected_422(client: AsyncClient) -> None:
    analyte_id = await make_analyte(client)
    response = await client.post(
        "/api/v1/qc-lots",
        json={
            "analyte_id": analyte_id,
            "lot_number": "L1",
            "manufacturer": "BioRad",
            "level": "Level 1",
            "target_mean": 100.0,
            "target_sd": 0.0,
            "expiration_date": "2027-01-01",
        },
    )
    assert response.status_code == 422


async def test_same_lot_number_allowed_across_levels(client: AsyncClient) -> None:
    analyte_id = await make_analyte(client)
    await make_lot(client, analyte_id, lot_number="L1", level="Level 1")
    await make_lot(client, analyte_id, lot_number="L1", level="Level 2")


async def test_duplicate_lot_triple_returns_409(client: AsyncClient) -> None:
    analyte_id = await make_analyte(client)
    await make_lot(client, analyte_id, lot_number="L1", level="Level 1")
    response = await client.post(
        "/api/v1/qc-lots",
        json={
            "analyte_id": analyte_id,
            "lot_number": "L1",
            "manufacturer": "BioRad",
            "level": "Level 1",
            "target_mean": 100.0,
            "target_sd": 5.0,
            "expiration_date": "2027-01-01",
        },
    )
    assert response.status_code == 409


async def test_list_filters_by_analyte_and_active(client: AsyncClient) -> None:
    a1 = await make_analyte(client, name="Glucose")
    a2 = await make_analyte(client, name="Sodium")
    await make_lot(client, a1, lot_number="G1", level="Level 1")
    await make_lot(client, a2, lot_number="S1", level="Level 1")

    by_analyte = await client.get("/api/v1/qc-lots", params={"analyte_id": a1})
    assert [lot["analyte_id"] for lot in by_analyte.json()] == [a1]

    all_active = await client.get("/api/v1/qc-lots", params={"active": True})
    assert len(all_active.json()) == 2


async def test_get_missing_returns_404(client: AsyncClient) -> None:
    assert (await client.get("/api/v1/qc-lots/999")).status_code == 404


async def test_retiring_a_lot_removes_it_from_the_dashboard(client: AsyncClient) -> None:
    analyte_id = await make_analyte(client)
    lot_id = await make_lot(client, analyte_id)
    assert len((await client.get("/api/v1/dashboard")).json()) == 1

    response = await client.patch(f"/api/v1/qc-lots/{lot_id}", json={"active": False})
    assert response.status_code == 200
    assert response.json()["active"] is False
    assert (await client.get("/api/v1/dashboard")).json() == []
    # Retired, not gone: still reachable by id.
    assert (await client.get(f"/api/v1/qc-lots/{lot_id}")).status_code == 200


async def test_revising_targets_rescores_the_whole_lot(client: AsyncClient) -> None:
    analyte_id = await make_analyte(client)
    lot_id = await make_lot(client, analyte_id)  # mean 100, sd 5
    # At SD 5 these sit between 0.6 and 1.4 SD, so nothing fires.
    for hour, value in enumerate((103.0, 104.0, 106.0, 107.0), start=8):
        await post_result(client, lot_id, value, f"2026-07-08T{hour:02d}:00:00Z")

    before = (await client.get(f"/api/v1/qc-lots/{lot_id}/results")).json()["results"]
    assert [r["status"] for r in before] == ["in_control"] * 4

    # Halving the SD moves the same values out to 1.2 through 2.8 SD. The
    # third result gaining a 1-2s is the proof the rescore reached mid-run
    # rather than only touching the most recent entry.
    response = await client.patch(f"/api/v1/qc-lots/{lot_id}", json={"target_sd": 2.5})
    assert response.status_code == 200

    after = (await client.get(f"/api/v1/qc-lots/{lot_id}/results")).json()["results"]
    assert [r["value"] for r in after] == [103.0, 104.0, 106.0, 107.0]
    assert after[0]["westgard_violations"] == []
    assert after[2]["westgard_violations"] == ["1-2s"]
    assert "4-1s" in after[3]["westgard_violations"]


async def test_revising_targets_ignores_voided_results(client: AsyncClient) -> None:
    analyte_id = await make_analyte(client)
    lot_id = await make_lot(client, analyte_id)
    first = await post_result(client, lot_id, 111.0, "2026-07-08T08:00:00Z")
    await void_result(client, first.json()["id"])
    await post_result(client, lot_id, 112.0, "2026-07-08T09:00:00Z")

    await client.patch(f"/api/v1/qc-lots/{lot_id}", json={"target_mean": 100.5})

    results = (await client.get(f"/api/v1/qc-lots/{lot_id}/results")).json()["results"]
    voided, live = results
    assert voided["status"] == "voided"
    # The voided excursion still must not pair with the live one.
    assert "2-2s" not in live["westgard_violations"]


async def test_update_rejects_non_positive_sd(client: AsyncClient) -> None:
    analyte_id = await make_analyte(client)
    lot_id = await make_lot(client, analyte_id)
    response = await client.patch(f"/api/v1/qc-lots/{lot_id}", json={"target_sd": 0})
    assert response.status_code == 422


async def test_update_missing_lot_returns_404(client: AsyncClient) -> None:
    assert (await client.patch("/api/v1/qc-lots/999", json={"active": False})).status_code == 404
