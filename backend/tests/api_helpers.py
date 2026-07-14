from httpx import AsyncClient, Response


async def make_analyte(client: AsyncClient, name: str = "Glucose", unit: str = "mg/dL") -> int:
    response = await client.post("/api/v1/analytes", json={"name": name, "unit": unit})
    assert response.status_code == 201, response.text
    return int(response.json()["id"])


async def make_lot(
    client: AsyncClient,
    analyte_id: int,
    *,
    lot_number: str = "L1",
    level: str = "Level 1",
    target_mean: float = 100.0,
    target_sd: float = 5.0,
) -> int:
    response = await client.post(
        "/api/v1/qc-lots",
        json={
            "analyte_id": analyte_id,
            "lot_number": lot_number,
            "manufacturer": "BioRad",
            "level": level,
            "target_mean": target_mean,
            "target_sd": target_sd,
            "expiration_date": "2027-01-01",
        },
    )
    assert response.status_code == 201, response.text
    return int(response.json()["id"])


async def post_result(
    client: AsyncClient,
    lot_id: int,
    value: float,
    recorded_at: str,
    recorded_by: str = "tech1",
) -> Response:
    return await client.post(
        "/api/v1/qc-results",
        json={
            "qc_lot_id": lot_id,
            "value": value,
            "recorded_by": recorded_by,
            "recorded_at": recorded_at,
        },
    )
