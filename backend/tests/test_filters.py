import pytest
from app.filters import filter_videos
from app.schemas import SearchParams, Video
from app.youtube import duration_seconds


def sample(**changes):
    fields = {name: None for name in Video.model_fields}
    fields.update(id="one", youtube_url="https://www.youtube.com/watch?v=one", view_count="1000", subscriber_count="123000", subscribers_hidden=False, duration_iso="PT10M", broadcast_status="none")
    fields.update(changes)
    return Video(**fields)


@pytest.mark.parametrize("value,expected", [("P1DT2H3M4S", 93784), ("P2D", 172800), ("PT1H", 3600), ("PT10M", 600), ("PT59S", 59), ("PT0S", 0), (None, None), ("invalid", None), ("PT", None), ("P1DT", None)])
def test_seconds(value, expected):
    assert duration_seconds(value) == expected


@pytest.mark.parametrize("field,param,threshold", [("view_count", "min_views", 1000), ("subscriber_count", "max_subscribers", 123000)])
def test_exact_threshold_and_missing_counts(field, param, threshold):
    params = SearchParams(q="test", **{param: threshold})
    assert filter_videos([sample()], params)
    for value in (None, "invalid", "-1"):
        assert filter_videos([sample(**{field: value})], params) == []
    rejected = threshold - 1 if param == "min_views" else threshold + 1
    assert filter_videos([sample(**{field: str(rejected)})], params) == []


def test_hidden_and_rounded_subscribers():
    params = SearchParams(q="test", max_subscribers=123000)
    assert filter_videos([sample(subscribers_hidden=True)], params) == []
    assert filter_videos([sample()], params)  # Valeur publique seule, pas de reconstruction.
    assert filter_videos([sample(subscriber_count="0")], SearchParams(q="test", max_subscribers=0))


@pytest.mark.parametrize("status", ["live", "upcoming"])
def test_broadcasts_do_not_have_final_duration(status):
    item = sample(broadcast_status=status, duration_iso="PT1H")
    assert filter_videos([item], SearchParams(q="test")) == [item]
    assert filter_videos([item], SearchParams(q="test", min_duration_minutes=0)) == []


def test_duration_boundaries_and_unknown_zero():
    params = SearchParams(q="test", min_duration_minutes=10)
    assert filter_videos([sample()], params)
    assert not filter_videos([sample(duration_iso="PT9M59S")], params)
    for duration in (None, "bad"):
        assert not filter_videos([sample(duration_iso=duration)], SearchParams(q="test", min_duration_minutes=0))
    assert filter_videos([sample(duration_iso="PT0S")], SearchParams(q="test", min_duration_minutes=0))


def test_and_order_and_large_integers():
    params = SearchParams(q="test", min_views=9007199254740993, max_subscribers=123000, min_duration_minutes=10)
    first = sample(view_count="9007199254740993")
    last = sample(id="last", view_count="9007199254740994")
    rejected = sample(view_count="9007199254740993", subscriber_count="123001")
    assert filter_videos([first, rejected, last], params) == [first, last]
    missing = sample(view_count=None, subscriber_count=None, duration_iso=None)
    assert filter_videos([missing], SearchParams(q="test")) == [missing]


@pytest.mark.parametrize("published,expected", [
    ("2026-05-31T23:59:59Z", False),
    ("2026-06-01T00:00:00Z", True),
    ("2026-06-15T12:00:00Z", True),
    ("2026-07-07T23:59:59Z", True),
    ("2026-07-07T23:59:59.999999Z", True),
    ("2026-07-08T00:00:00Z", False),
    ("2026-11-03T12:00:00Z", False),
    ("2026-06-01T02:00:00+02:00", True),
    ("2026-07-08T02:00:00+02:00", False),
    ("2026-06-01T00:30:00+02:00", False),
    (None, False), ("invalid", False), ("2026-06-15", False),
    ("2026-06-15T12:00:00", False), ("2026-06-31T12:00:00Z", False),
])
def test_enriched_publication_period(published, expected):
    params = SearchParams(q="test", published_after="2026-06-01T00:00:00Z", published_before="2026-07-08T00:00:00Z", min_views=1000, min_duration_minutes=3)
    assert bool(filter_videos([sample(published_at=published)], params)) is expected


@pytest.mark.parametrize("bounds,published,expected", [
    ({"published_after": "2026-06-01T00:00:00Z"}, "2026-11-03T12:00:00Z", True),
    ({"published_after": "2026-06-01T00:00:00Z"}, "2026-05-31T23:59:59Z", False),
    ({"published_before": "2026-07-08T00:00:00Z"}, "2026-05-31T23:59:59Z", True),
    ({"published_before": "2026-07-08T00:00:00Z"}, "2026-07-08T00:00:00Z", False),
    ({"published_before": "2026-07-08T00:00:00Z"}, None, False),
    ({"published_after": "2026-06-01T00:00:00Z"}, "bad", False),
    ({}, None, True), ({}, "bad", True),
])
def test_single_bound_and_no_period(bounds, published, expected):
    assert bool(filter_videos([sample(published_at=published)], SearchParams(q="test", **bounds))) is expected


def test_search_dates_are_timezone_aware_and_normalized_to_utc():
    from datetime import timezone
    params = SearchParams(q="test", published_after="2026-06-01T02:00:00+02:00", published_before="2026-07-08T02:00:00+02:00")
    assert params.published_after.tzinfo is timezone.utc
    assert params.published_before.tzinfo is timezone.utc
    assert params.published_after.isoformat() == "2026-06-01T00:00:00+00:00"


def test_dates_and_metrics_require_all_conditions():
    params = SearchParams(q="test", published_after="2026-06-01T00:00:00Z", published_before="2026-07-08T00:00:00Z", min_views=10000, min_duration_minutes=3)
    matching = sample(published_at="2026-06-15T00:00:00Z", view_count="10000", duration_iso="PT3M")
    assert filter_videos([
        matching, matching.model_copy(update={"view_count": "9999"}),
        matching.model_copy(update={"duration_iso": "PT2M59S"}),
        matching.model_copy(update={"published_at": "2026-11-03T00:00:00Z"}),
    ], params) == [matching]
