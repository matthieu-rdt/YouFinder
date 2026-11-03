import json
import logging
from dataclasses import replace

import httpx
import pytest

from app.config import get_settings
from app.errors import SearchError


def test_missing_key_does_not_contact_google_or_count(api):
    api.settings = replace(api.settings, api_key="")
    response = api.get({"q": "python"})
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "youtube_not_configured"
    assert api.calls == []
    assert not api.settings.quota_path.exists()
    assert api.get(path="/api/health").json() == {"status": "ok"}


def test_empty_results_and_no_pagination(api):
    api.handler = lambda request: httpx.Response(200, json={"items": [], "nextPageToken": "ignored"})
    response = api.get({"q": " python "})
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert response.json()["items"] == []
    assert response.json()["searches_remaining"] == 19
    assert len(api.calls) == 1
    query = api.calls[0].url.params
    assert query["q"] == "python"
    assert query["maxResults"] == "10"
    assert query["type"] == "video"
    assert query["order"] == "relevance"
    assert "pageToken" not in query
    assert "key" not in query
    assert api.calls[0].headers["X-Goog-Api-Key"] == api.settings.api_key


@pytest.mark.parametrize("params", [
    {}, {"q": ""}, {"q": "   "}, {"q": "x" * 201},
    {"q": "python", "published_after": "invalid"},
    {"q": "python", "published_after": "1700000000"},
    {"q": "python", "published_after": "2026-01-01T00:00:00"},
    {"q": "python", "published_after": "2026-02-01T00:00:00Z", "published_before": "2026-01-01T00:00:00Z"},
    {"q": "python", "max_results": 50},
])
def test_invalid_parameters_do_not_consume_quota(api, params):
    response = api.get(params)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_parameters"
    assert not api.calls
    assert not api.settings.quota_path.exists()


def test_dates_are_forwarded_in_utc(api):
    response = api.get({"q": "python", "published_after": "2026-01-01T01:00:00+01:00", "published_before": "2026-01-02T23:59:59.999Z"})
    assert response.status_code == 200
    assert api.calls[0].url.params["publishedAfter"] == "2026-01-01T00:00:00Z"
    assert api.calls[0].url.params["publishedBefore"] == "2026-01-02T23:59:59.999000Z"


@pytest.mark.parametrize("status,reason,expected,code", [
    (400, "keyInvalid", 503, "youtube_access_denied"),
    (403, "accessNotConfigured", 503, "youtube_access_denied"),
    (403, "quotaExceeded", 429, "youtube_quota_exceeded"),
    (403, "dailyLimitExceeded", 429, "youtube_quota_exceeded"),
    (403, "rateLimitExceeded", 429, "youtube_rate_limited"),
    (429, "anything", 429, "youtube_rate_limited"),
    (500, "backendError", 502, "youtube_http_error"),
    (400, "badRequest", 502, "youtube_http_error"),
])
def test_google_errors_are_sanitized_and_not_retried(api, caplog, status, reason, expected, code):
    caplog.set_level(logging.DEBUG)
    api.handler = lambda request: httpx.Response(status, json={"error": {"message": api.settings.api_key, "errors": [{"reason": reason}]}})
    response = api.get({"q": "python"})
    assert response.status_code == expected
    assert response.json()["error"]["code"] == code
    assert len(api.calls) == 1
    assert json.loads(api.settings.quota_path.read_text())["count"] == 1
    assert api.settings.api_key not in response.text + caplog.text + repr(api.settings)


@pytest.mark.parametrize("exception,expected,code", [
    (httpx.ReadTimeout, 504, "youtube_timeout"),
    (httpx.ConnectError, 502, "youtube_unavailable"),
])
def test_network_failures_without_retry(api, caplog, exception, expected, code):
    def handler(request):
        raise exception(api.settings.api_key, request=request)
    api.handler = handler
    response = api.get({"q": "python"})
    assert response.status_code == expected
    assert response.json()["error"]["code"] == code
    assert len(api.calls) == 1
    assert api.settings.api_key not in response.text + caplog.text


@pytest.mark.parametrize("body", ["not-json", "{}", '{"items":null}'])
def test_malformed_google_response(api, body):
    api.handler = lambda request: httpx.Response(200, text=body)
    response = api.get({"q": "python"})
    assert response.status_code == 502
    assert response.json()["error"]["code"] == "youtube_invalid_response"


def test_internal_limit_blocks_twenty_first_attempt(api):
    for _ in range(20):
        assert api.get({"q": "python"}).status_code == 200
    response = api.get({"q": "python"})
    assert response.status_code == 429
    assert response.json()["error"]["code"] == "daily_limit_reached"
    assert len(api.calls) == 20


def test_configurable_limit_and_disabled_search(api):
    api.settings = replace(api.settings, daily_limit=1)
    assert api.get({"q": "python"}).json()["searches_remaining"] == 0
    assert api.get({"q": "python"}).status_code == 429
    api.settings = replace(api.settings, daily_limit=0)
    assert api.get({"q": "python"}).status_code == 429
    assert len(api.calls) == 1


def test_corrupt_quota_fails_closed(api):
    api.settings.quota_path.write_text("broken")
    response = api.get({"q": "python"})
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "quota_storage_unavailable"
    assert not api.calls


def test_environment_settings(monkeypatch):
    monkeypatch.setenv("YOUTUBE_API_KEY", "simulated-env-key")
    monkeypatch.setenv("YOUTUBE_DAILY_SEARCH_LIMIT", "7")
    assert get_settings().api_key == "simulated-env-key"
    assert get_settings().daily_limit == 7


def test_default_settings(monkeypatch):
    monkeypatch.delenv("YOUTUBE_API_KEY", raising=False)
    monkeypatch.delenv("YOUTUBE_DAILY_SEARCH_LIMIT", raising=False)
    assert get_settings().api_key == ""
    assert get_settings().daily_limit == 20


def test_real_client_configuration_keeps_key_out_of_urls_logs_and_openapi(api, monkeypatch, caplog):
    from app.main import app
    from app.routes.videos import get_http_client

    caplog.set_level(logging.DEBUG)
    app.dependency_overrides.pop(get_http_client)
    requests = []
    mock_transport = httpx.MockTransport(lambda request: httpx.Response(200, json={"items": []}))

    async def handle(transport, request):
        requests.append(request)
        return await mock_transport.handle_async_request(request)

    monkeypatch.setattr(httpx.AsyncHTTPTransport, "handle_async_request", handle)
    response = api.get({"q": "python"})
    assert response.status_code == 200
    assert len(requests) == 1
    assert requests[0].headers["X-Goog-Api-Key"] == api.settings.api_key
    assert api.settings.api_key not in str(requests[0].url)
    assert api.settings.api_key not in response.text + caplog.text + api.get(path="/openapi.json").text


@pytest.mark.parametrize("value", ["-1", "bad"])
def test_invalid_limit_configuration(monkeypatch, value):
    monkeypatch.setenv("YOUTUBE_DAILY_SEARCH_LIMIT", value)
    with pytest.raises(SearchError) as error:
        get_settings()
    assert error.value.code == "configuration_error"


@pytest.mark.parametrize("name", ["min_views", "max_subscribers", "min_duration_minutes"])
@pytest.mark.parametrize("value", ["-1", "1.5", "1.0", "bad", "", "1e3"])
def test_invalid_filters_do_not_consume_quota(api, name, value):
    response = api.get({"q": "test", name: value})
    assert response.status_code == 422
    assert not api.calls
    assert not api.settings.quota_path.exists()
