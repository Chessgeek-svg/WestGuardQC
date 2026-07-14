from httpx import AsyncClient

from tests.api_helpers import make_analyte


async def test_create_returns_201_with_timestamps(client: AsyncClient) -> None:
    response = await client.post("/api/v1/analytes", json={"name": "Sodium", "unit": "mmol/L"})
    assert response.status_code == 201
    body = response.json()
    assert body["id"] > 0
    assert body["name"] == "Sodium"
    assert body["created_at"] is not None


async def test_duplicate_name_returns_409(client: AsyncClient) -> None:
    await make_analyte(client, name="Glucose")
    response = await client.post("/api/v1/analytes", json={"name": "Glucose", "unit": "mg/dL"})
    assert response.status_code == 409


async def test_blank_name_is_rejected_422(client: AsyncClient) -> None:
    response = await client.post("/api/v1/analytes", json={"name": "", "unit": "mg/dL"})
    assert response.status_code == 422


async def test_list_is_ordered_by_name(client: AsyncClient) -> None:
    await make_analyte(client, name="Potassium")
    await make_analyte(client, name="Calcium")
    response = await client.get("/api/v1/analytes")
    assert response.status_code == 200
    assert [a["name"] for a in response.json()] == ["Calcium", "Potassium"]


async def test_get_missing_returns_404(client: AsyncClient) -> None:
    assert (await client.get("/api/v1/analytes/999")).status_code == 404
