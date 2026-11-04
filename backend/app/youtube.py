"""Accès aux seuls endpoints officiels et assemblage des données publiques."""

import re
from datetime import timezone
from html import unescape
from urllib.parse import quote

import httpx
from pydantic import BaseModel, Field, ValidationError

from app.errors import SearchError
from app.schemas import SearchParams, Video

BASE_URL = "https://www.googleapis.com/youtube/v3/"


class Thumbnail(BaseModel):
    url: str | None = None


class Snippet(BaseModel):
    title: str | None = None
    channelId: str | None = None
    channelTitle: str | None = None
    publishedAt: str | None = None
    liveBroadcastContent: str | None = None
    thumbnails: dict[str, Thumbnail] = Field(default_factory=dict)


class Statistics(BaseModel):
    viewCount: str | None = None
    subscriberCount: str | None = None
    hiddenSubscriberCount: bool | None = None


class ContentDetails(BaseModel):
    duration: str | None = None


class Resource(BaseModel):
    id: str
    snippet: Snippet = Field(default_factory=Snippet)
    statistics: Statistics = Field(default_factory=Statistics)
    contentDetails: ContentDetails = Field(default_factory=ContentDetails)


class ResourcePage(BaseModel):
    items: list[Resource]


class SearchId(BaseModel):
    videoId: str


class SearchItem(BaseModel):
    id: SearchId


class SearchPage(BaseModel):
    items: list[SearchItem] = Field(max_length=50)
    nextPageToken: str | None = Field(default=None, min_length=1, max_length=2048, strict=True)


def duration_seconds(value: str | None) -> int | None:
    """Convertit les durées YouTube (jours/heures/minutes/secondes), sans zéro fictif."""
    if not value:
        return None
    match = re.fullmatch(r"P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?", value, flags=re.ASCII)
    if not match or not any(part is not None for part in match.groups()):
        return None
    if "T" in value and not any(part is not None for part in match.groups()[1:]):
        return None
    days, hours, minutes, seconds = (int(part or 0) for part in match.groups())
    return days * 86400 + hours * 3600 + minutes * 60 + seconds


def duration_label(value: str | None) -> str | None:
    total = duration_seconds(value)
    if total is None:
        return None
    hours, rest = divmod(total, 3600)
    minutes, seconds = divmod(rest, 60)
    return f"{hours}:{minutes:02}:{seconds:02}" if hours else f"{minutes}:{seconds:02}"


def public_count(value: str | None) -> str | None:
    # Garder des chaînes évite la perte de précision des grands entiers en JS.
    return value if value and value.isascii() and value.isdecimal() else None


def thumbnail_url(snippet: Snippet) -> str | None:
    for size in ("high", "medium", "default"):
        thumb = snippet.thumbnails.get(size)
        if thumb and thumb.url and thumb.url.startswith("https://"):
            return thumb.url
    return None


class YouTubeClient:
    def __init__(self, client: httpx.AsyncClient):
        self.client = client

    async def _get(self, endpoint: str, params: dict, model):
        try:
            response = await self.client.get(BASE_URL + endpoint, params=params)
        except httpx.TimeoutException:
            raise SearchError(504, "youtube_timeout", "YouTube met trop de temps à répondre.") from None
        except httpx.RequestError:
            raise SearchError(502, "youtube_unavailable", "Connexion à YouTube impossible.") from None
        if response.status_code >= 400:
            reasons = set()
            try:
                errors = response.json()["error"]["errors"]
                reasons = {error["reason"] for error in errors if isinstance(error, dict) and isinstance(error.get("reason"), str)}
            except (ValueError, KeyError, TypeError):
                pass
            if "invalidPageToken" in reasons:
                raise SearchError(400, "invalid_page_token", "Le jeton YouTube est invalide. Relancez la recherche depuis la première page.")
            if reasons & {"quotaExceeded", "dailyLimitExceeded", "dailyLimitExceededUnreg"}:
                raise SearchError(429, "youtube_quota_exceeded", "Quota Google YouTube épuisé. Aucune nouvelle tentative automatique.")
            if response.status_code == 429 or reasons & {"rateLimitExceeded", "userRateLimitExceeded"}:
                raise SearchError(429, "youtube_rate_limited", "YouTube limite temporairement les requêtes.")
            if response.status_code in (401, 403) or reasons & {"keyInvalid", "accessNotConfigured", "ipRefererBlocked"}:
                raise SearchError(503, "youtube_access_denied", "Accès YouTube refusé. Vérifiez la configuration backend de la clé et de l’API.")
            raise SearchError(502, "youtube_http_error", "YouTube a renvoyé une erreur. Réessayez manuellement plus tard.")
        try:
            return model.model_validate(response.json())
        except (ValueError, ValidationError):
            raise SearchError(502, "youtube_invalid_response", "La réponse de YouTube est inexploitable.") from None

    async def search(self, params: SearchParams) -> tuple[list[Video], int, str | None]:
        query = {"part": "snippet", "type": "video", "maxResults": 50, "order": "relevance", "q": params.q}
        for name, value in (("publishedAfter", params.published_after), ("publishedBefore", params.published_before)):
            if value:
                query[name] = value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
        if params.page_token is not None:
            query["pageToken"] = params.page_token
        search = await self._get("search", query, SearchPage)
        # Une page par action ; jamais de parcours automatique.
        ids = list(dict.fromkeys(item.id.videoId for item in search.items))
        if not ids:
            return [], 0, search.nextPageToken
        video_page = await self._get("videos", {"part": "snippet,statistics,contentDetails", "id": ",".join(ids)}, ResourcePage)
        videos = {video.id: video for video in video_page.items}
        channel_ids = list(dict.fromkeys(videos[id].snippet.channelId for id in ids if id in videos and videos[id].snippet.channelId))
        channels = {}
        if channel_ids:
            channel_page = await self._get("channels", {"part": "statistics", "id": ",".join(channel_ids)}, ResourcePage)
            channels = {channel.id: channel.statistics for channel in channel_page.items}
        results = []
        for id in ids:
            if id not in videos:
                continue  # Vidéo retirée/indisponible entre les deux appels.
            video = videos[id]
            snippet = video.snippet
            channel = channels.get(snippet.channelId, Statistics())
            duration = video.contentDetails.duration
            results.append(Video(
                id=id,
                title=unescape(snippet.title) if snippet.title is not None else None,
                thumbnail_url=thumbnail_url(snippet),
                channel_id=snippet.channelId,
                channel_title=unescape(snippet.channelTitle) if snippet.channelTitle is not None else None,
                channel_url=f"https://www.youtube.com/channel/{quote(snippet.channelId, safe='')}" if snippet.channelId else None,
                published_at=snippet.publishedAt,
                view_count=public_count(video.statistics.viewCount),
                subscriber_count=None if channel.hiddenSubscriberCount else public_count(channel.subscriberCount),
                subscribers_hidden=channel.hiddenSubscriberCount,
                duration_iso=duration,
                duration_label=None if snippet.liveBroadcastContent in ("live", "upcoming") else duration_label(duration),
                broadcast_status=snippet.liveBroadcastContent,
                youtube_url=f"https://www.youtube.com/watch?v={quote(id, safe='')}",
            ))
        return results, len(ids) - len(results), search.nextPageToken
