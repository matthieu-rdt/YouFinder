import asyncio

from httpx import ASGITransport, AsyncClient

from app.main import app


def get(path: str):
    async def request():
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            return await client.get(path)

    return asyncio.run(request())


def test_health_contract():
    response = get("/api/health")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/json"
    assert response.json() == {"status": "ok"}


def test_health_documented_in_openapi():
    schema = get("/openapi.json").json()
    assert "200" in schema["paths"]["/api/health"]["get"]["responses"]
