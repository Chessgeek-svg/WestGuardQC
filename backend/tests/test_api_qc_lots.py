from httpx import AsyncClient

from tests.api_helpers import make_analyte, make_lot


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
