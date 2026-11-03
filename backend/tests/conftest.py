import asyncio

import httpx
import pytest

from app.config import Settings, get_settings
from app.main import app
from app.routes.videos import get_http_client


@pytest.fixture
def api(tmp_path):
    """Tous les appels Google sont interceptés ; le compteur est isolé par test."""
    class Harness:
        settings = Settings(api_key="simulated-key-not-a-secret", quota_path=tmp_path / "quota.json")

        def __init__(self):
            self.calls = []
            self.handler = lambda request: httpx.Response(200, json={"items": []})

        def transport(self, request):
            self.calls.append(request)
            return self.handler(request)

        async def client(self):
            async with httpx.AsyncClient(
                transport=httpx.MockTransport(self.transport),
                headers={"X-Goog-Api-Key": self.settings.api_key},
                timeout=10,
            ) as client:
                yield client

        def get(self, params=None, path="/api/videos/search"):
            async def request():
                async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
                    return await client.get(path, params=params)
            return asyncio.run(request())

    harness = Harness()
    app.dependency_overrides[get_settings] = lambda: harness.settings
    app.dependency_overrides[get_http_client] = harness.client
    yield harness
    app.dependency_overrides.clear()
