"""Pagination : données entièrement simulées, aucun accès à Google."""
import json
from dataclasses import replace

import httpx
import pytest

from test_youtube import video


def install_pages(api, *, filtered=False, duplicate=False):
    def handler(request):
        endpoint = request.url.path.rsplit('/', 1)[-1]
        if endpoint == 'search':
            second = 'pageToken' in request.url.params
            ids = [str(i) for i in range(50 if second else 0, 100 if second else 50)]
            if second and duplicate:
                ids[0] = '0'
            return httpx.Response(200, json={'items': [{'id': {'videoId': id}} for id in ids], 'nextPageToken': 'third' if second else 'opaque+/= token'})
        if endpoint == 'videos':
            return httpx.Response(200, json={'items': [video(id, statistics={'viewCount': '0' if filtered else '1234'}) for id in reversed(request.url.params['id'].split(','))]})
        return httpx.Response(200, json={'items': [{'id': 'channel-one', 'statistics': {'subscriberCount': '123', 'hiddenSubscriberCount': False}}]})
    api.handler = handler


def continuation(body, **criteria):
    return {'q': 'python', **criteria, 'page_token': body['next_page_token'], 'page_signature': body['next_page_signature']}


def test_two_fifty_result_pages_order_duplicates_and_no_third_authorization(api):
    install_pages(api, duplicate=True)
    first = api.get({'q': 'python'}).json()
    assert first['page_number'] == 1
    assert [v['id'] for v in first['items']] == [str(i) for i in range(50)]
    assert len(api.calls) == 3  # Aucun préchargement.
    second = api.get(continuation(first)).json()
    assert second['page_number'] == 2
    assert [v['id'] for v in second['items']] == ['0'] + [str(i) for i in range(51, 100)]
    assert second['next_page_token'] is None
    assert second['next_page_signature'] is None
    assert second['searches_remaining'] == 18
    assert len(api.calls) == 6
    assert api.calls[3].url.params['pageToken'] == 'opaque+/= token'
    assert all(call.url.params['maxResults'] == '50' for call in api.calls if call.url.path.endswith('/search'))
    assert sum(len(call.url.params['id'].split(',')) for call in api.calls if call.url.path.endswith('/videos')) == 100
    # La signature de la page 2 ne permet pas de suivre le jeton de la page 3.
    assert api.get({**continuation(first), 'page_token': 'third'}).status_code == 422
    assert len(api.calls) == 6


def test_fully_filtered_page_still_has_continuation(api):
    install_pages(api, filtered=True)
    first = api.get({'q': 'python', 'min_views': 1}).json()
    assert first['items'] == []
    assert first['examined_count'] == first['filtered_out_count'] == 50
    second = api.get(continuation(first, min_views=1)).json()
    assert second['items'] == []
    assert second['next_page_token'] is None
    assert len(api.calls) == 6


@pytest.mark.parametrize('changes', [
    {'q': 'other'}, {'min_views': 0}, {'max_subscribers': 1},
    {'min_duration_minutes': 3}, {'published_after': '2026-01-01T00:00:00Z'},
    {'published_before': '2026-02-01T00:00:00Z'},
    {'page_token': 'different'}, {'page_signature': '0' * 64},
])
def test_changed_criteria_or_tampered_token_rejected_without_quota(api, changes):
    install_pages(api)
    first = api.get({'q': 'python'}).json()
    response = api.get({**continuation(first), **changes})
    assert response.status_code == 422
    assert len(api.calls) == 3
    assert json.loads(api.settings.quota_path.read_text())['count'] == 1


@pytest.mark.parametrize('params', [
    {'page_token': ''}, {'page_token': 'x'}, {'page_signature': '0' * 64},
    {'page_token': 'x' * 2049, 'page_signature': '0' * 64},
    {'page_token': 'x', 'page_signature': 'invalid'},
    {'page_number': 3},
])
def test_invalid_pagination_input(api, params):
    assert api.get({'q': 'python', **params}).status_code == 422
    assert not api.calls
    assert not api.settings.quota_path.exists()


def test_no_next_token_ends_pagination(api):
    body = api.get({'q': 'python'}).json()
    assert body['next_page_token'] is None
    assert body['next_page_signature'] is None
    assert len(api.calls) == 1


@pytest.mark.parametrize('token', ['', 123, [], 'x' * 2049])
def test_invalid_google_token_is_not_an_empty_success(api, token):
    api.handler = lambda request: httpx.Response(200, json={'items': [], 'nextPageToken': token})
    response = api.get({'q': 'python'})
    assert response.status_code == 502
    assert response.json()['error']['code'] == 'youtube_invalid_response'
    assert len(api.calls) == 1


def test_oversized_google_page_is_rejected(api):
    api.handler = lambda request: httpx.Response(200, json={'items': [{'id': {'videoId': str(i)}} for i in range(51)]})
    assert api.get({'q': 'python'}).status_code == 502
    assert len(api.calls) == 1


@pytest.mark.parametrize('failure', ['network', 'invalid_token', 'quota'])
def test_second_page_failure_counts_once_without_retry(api, failure):
    install_pages(api)
    first = api.get({'q': 'python'}).json()
    def handler(request):
        if failure == 'network':
            raise httpx.ConnectError('simulated offline', request=request)
        return httpx.Response(400 if failure == 'invalid_token' else 403, json={'error': {'errors': [{'reason': 'invalidPageToken' if failure == 'invalid_token' else 'quotaExceeded'}]}})
    api.handler = handler
    response = api.get(continuation(first))
    assert response.status_code == {'network': 502, 'invalid_token': 400, 'quota': 429}[failure]
    assert len(api.calls) == 4
    assert json.loads(api.settings.quota_path.read_text())['count'] == 2


def test_quota_exhausted_before_second_page(api):
    api.settings = replace(api.settings, daily_limit=1)
    install_pages(api)
    first = api.get({'q': 'python'}).json()
    assert first['searches_remaining'] == 0
    assert api.get(continuation(first)).status_code == 429
    assert len(api.calls) == 3


def test_duplicate_identifiers_within_page_are_enriched_once(api):
    def handler(request):
        if request.url.path.endswith('/search'):
            return httpx.Response(200, json={'items': [{'id': {'videoId': 'one'}}] * 50})
        if request.url.path.endswith('/videos'):
            assert request.url.params['id'] == 'one'
            return httpx.Response(200, json={'items': [video('one')]})
        return httpx.Response(200, json={'items': []})
    api.handler = handler
    body = api.get({'q': 'python'}).json()
    assert body['examined_count'] == body['retained_count'] == 1


def test_repeated_google_token_stops_after_second_page(api):
    api.handler = lambda request: httpx.Response(200, json={'items': [], 'nextPageToken': 'same'})
    first = api.get({'q': 'python'}).json()
    second = api.get(continuation(first)).json()
    assert second['next_page_token'] is None
    assert 'répété' in second['notice']
    assert len(api.calls) == 2


def test_dates_and_filters_preserved_on_second_page(api):
    install_pages(api)
    criteria = {'min_views': 1000, 'max_subscribers': 123, 'min_duration_minutes': 62,
                'published_after': '2026-01-01T00:00:00Z', 'published_before': '2026-01-02T00:00:00Z'}
    first = api.get({'q': 'python', **criteria}).json()
    second = api.get(continuation(first, **criteria)).json()
    assert second['retained_count'] == 50
    assert api.calls[3].url.params['publishedAfter'] == criteria['published_after']
    assert api.calls[3].url.params['publishedBefore'] == criteria['published_before']
