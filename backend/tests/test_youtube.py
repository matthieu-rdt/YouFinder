import httpx
import pytest

from app.youtube import duration_label


def video(id, channel="channel-one", **overrides):
    return {"id": id, "snippet": {"title": f"Vidéo {id} &amp; Python", "channelId": channel, "channelTitle": "Chaîne", "publishedAt": "2026-01-01T00:00:00Z", "liveBroadcastContent": "none", "thumbnails": {"medium": {"url": "https://i.ytimg.com/vi/example/mqdefault.jpg"}}}, "statistics": {"viewCount": "1234"}, "contentDetails": {"duration": "PT1H2M3S"}, **overrides}


def test_order_batched_channels_and_missing_video(api):
    def handler(request):
        endpoint = request.url.path.rsplit("/", 1)[-1]
        items = {
            "search": [{"id": {"videoId": id}} for id in ("second", "removed", "first")],
            "videos": [video("first"), video("second")],
            "channels": [{"id": "channel-one", "statistics": {"subscriberCount": "123000", "hiddenSubscriberCount": False}}],
        }
        return httpx.Response(200, json={"items": items[endpoint], "nextPageToken": "ignored"})
    api.handler = handler
    response = api.get({"q": "python"})
    assert response.status_code == 200
    body = response.json()
    assert [item["id"] for item in body["items"]] == ["second", "first"]
    assert body["omitted_count"] == 1
    item = body["items"][0]
    assert item["title"] == "Vidéo second & Python"
    assert item["view_count"] == "1234"
    assert item["subscriber_count"] == "123000"
    assert item["duration_label"] == "1:02:03"
    assert item["youtube_url"] == "https://www.youtube.com/watch?v=second"
    assert item["thumbnail_url"].startswith("https://i.ytimg.com/")
    assert len(api.calls) == 3
    assert api.calls[1].url.params["id"] == "second,removed,first"
    assert api.calls[2].url.params["id"] == "channel-one"


@pytest.mark.parametrize("hidden,subscriber_count", [(True, "123"), (False, None), (None, None)])
def test_missing_statistics_are_not_invented(api, hidden, subscriber_count):
    def handler(request):
        endpoint = request.url.path.rsplit("/", 1)[-1]
        items = {
            "search": [{"id": {"videoId": "one"}}],
            "videos": [video("one", statistics={}, contentDetails={})],
            "channels": [{"id": "channel-one", "statistics": {"hiddenSubscriberCount": hidden, "subscriberCount": subscriber_count}}],
        }
        return httpx.Response(200, json={"items": items[endpoint]})
    api.handler = handler
    item = api.get({"q": "python"}).json()["items"][0]
    assert item["view_count"] is None
    assert item["subscriber_count"] is None
    assert item["duration_label"] is None
    assert item["duration_iso"] is None


def test_live_and_unavailable_channel(api):
    def handler(request):
        if request.url.path.endswith("/search"):
            items = [{"id": {"videoId": "one"}}]
        elif request.url.path.endswith("/videos"):
            data = video("one")
            data["snippet"]["liveBroadcastContent"] = "live"
            items = [data]
        else:
            items = []
        return httpx.Response(200, json={"items": items})
    api.handler = handler
    item = api.get({"q": "python"}).json()["items"][0]
    assert item["broadcast_status"] == "live"
    assert item["duration_label"] is None
    assert item["subscriber_count"] is None


def test_enrichment_error_is_not_an_empty_success(api):
    def handler(request):
        if request.url.path.endswith("/search"):
            return httpx.Response(200, json={"items": [{"id": {"videoId": "one"}}]})
        return httpx.Response(503, text="unavailable")
    api.handler = handler
    response = api.get({"q": "python"})
    assert response.status_code == 502
    assert len(api.calls) == 2


@pytest.mark.parametrize("value,expected", [("PT15M33S", "15:33"), ("P1DT2H3M4S", "26:03:04"), ("PT9S", "0:09"), ("PT0S", "0:00"), ("PT1H", "1:00:00"), (None, None), ("invalid", None), ("PT", None)])
def test_duration_formatting(value, expected):
    assert duration_label(value) == expected


def test_combined_filters_counts_and_call_budget(api):
    def handler(request):
        endpoint = request.url.path.rsplit("/", 1)[-1]
        items = {
            "search": [{"id": {"videoId": id}} for id in ("keep", "removed", "reject")],
            "videos": [video("keep"), video("reject", statistics={"viewCount": "1"})],
            "channels": [{"id": "channel-one", "statistics": {"subscriberCount": "123000", "hiddenSubscriberCount": False}}],
        }
        return httpx.Response(200, json={"items": items[endpoint], "nextPageToken": "ignored"})
    api.handler = handler
    body = api.get({"q": "test", "min_views": 1234, "max_subscribers": 123000, "min_duration_minutes": 62}).json()
    assert [item["id"] for item in body["items"]] == ["keep"]
    assert (body["examined_count"], body["retained_count"], body["filtered_out_count"], body["omitted_count"]) == (2, 1, 1, 1)
    assert body["searches_remaining"] == 19
    assert len(api.calls) == 3
    assert "min_views" not in api.calls[0].url.params


@pytest.mark.parametrize("omit_invalid", [False, True])
def test_reported_date_regression_final_dates_counts_and_budget(api, omit_invalid):
    import json
    dates = {
        "november": "2026-11-03T12:00:00Z", "last": "2026-07-07T23:59:59.999999Z",
        "before": "2026-05-31T23:59:59Z", "first": "2026-06-01T00:00:00Z",
        "next": "2026-07-08T00:00:00Z", "middle": "2026-06-15T12:00:00Z",
        "missing": None, "invalid": "bad", "few-views": "2026-06-15T00:00:00Z",
        "short": "2026-06-15T00:00:00Z",
    }
    def handler(request):
        endpoint = request.url.path.rsplit("/", 1)[-1]
        if endpoint == "search":
            # Données simulées : search et videos peuvent contenir des dates différentes.
            items = [{"id": {"videoId": id}, "snippet": {"publishedAt": "2026-06-15T00:00:00Z"}} for id in dates]
        elif endpoint == "videos":
            items = []
            for id, published in reversed(list(dates.items())):
                if omit_invalid and id == "invalid":
                    continue
                item = video(id, statistics={"viewCount": "9999" if id == "few-views" else "10000"}, contentDetails={"duration": "PT2M59S" if id == "short" else "PT3M"})
                item["snippet"]["publishedAt"] = published
                items.append(item)
        else:
            items = [{"id": "channel-one", "statistics": {"hiddenSubscriberCount": True}}]
        return httpx.Response(200, json={"items": items, "nextPageToken": "ignored"})
    api.handler = handler
    response = api.get({"q": "test", "published_after": "2026-06-01T00:00:00Z", "published_before": "2026-07-08T00:00:00Z", "min_views": 10000, "min_duration_minutes": 3})
    assert response.status_code == 200
    body = response.json()
    assert [item["id"] for item in body["items"]] == ["last", "first", "middle"]
    assert body["examined_count"] == 10 - int(omit_invalid)
    assert body["retained_count"] == 3
    assert body["filtered_out_count"] == 7 - int(omit_invalid)
    assert body["omitted_count"] == int(omit_invalid)
    assert body["searches_remaining"] == 19
    assert json.loads(api.settings.quota_path.read_text())["count"] == 1
    assert len(api.calls) == 3
    query = api.calls[0].url.params
    assert query["publishedAfter"] == "2026-06-01T00:00:00Z"
    assert query["publishedBefore"] == "2026-07-08T00:00:00Z"
    assert query["maxResults"] == "10"
    assert query["order"] == "relevance"
    assert "pageToken" not in query
