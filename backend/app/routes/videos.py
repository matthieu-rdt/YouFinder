import hashlib
import hmac
import json
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, Query
from starlette.concurrency import run_in_threadpool

from app.config import Settings, get_settings
from app.errors import SearchError
from app.quota import DailyQuota
from app.filters import filter_videos
from app.schemas import SearchParams, SearchResponse
from app.youtube import YouTubeClient

router = APIRouter(prefix="/api/videos", tags=["YouTube"])


async def get_http_client(settings: Annotated[Settings, Depends(get_settings)]):
    # La clé est dans un en-tête HTTPS, jamais dans l'URL journalisée par HTTPX.
    # Aucun retry, aucune redirection suivie avec cet en-tête.
    async with httpx.AsyncClient(
        headers={"X-Goog-Api-Key": settings.api_key},
        timeout=httpx.Timeout(10.0, connect=5.0),
        follow_redirects=False,
    ) as client:
        yield client


def continuation_signature(params: SearchParams, token: str, key: str) -> str:
    """Autorise uniquement la continuation émise pour ces critères normalisés."""
    criteria = params.model_dump(mode="json", exclude={"page_token", "page_signature"})
    payload = json.dumps(["youfinder-page-2-v1", criteria, token], sort_keys=True, separators=(",", ":"))
    return hmac.new(key.encode(), payload.encode(), hashlib.sha256).hexdigest()


@router.get("/search", response_model=SearchResponse)
async def search_videos(
    params: Annotated[SearchParams, Query()],
    settings: Annotated[Settings, Depends(get_settings)],
    client: Annotated[httpx.AsyncClient, Depends(get_http_client)],
) -> SearchResponse:
    if not settings.api_key:
        raise SearchError(503, "youtube_not_configured", "La recherche YouTube n’est pas configurée côté backend.")
    if params.page_token is not None and not hmac.compare_digest(
        params.page_signature or "", continuation_signature(params, params.page_token, settings.api_key)
    ):
        raise SearchError(422, "invalid_page_token", "Continuation invalide pour ces critères. Relancez la recherche.")
    remaining = await run_in_threadpool(DailyQuota(settings.quota_path, settings.daily_limit).reserve)
    items, omitted, next_token = await YouTubeClient(client).search(params)
    repeated_token = params.page_token is not None and next_token == params.page_token
    # Seule la première page délivre une autorisation de continuation.
    if params.page_token is not None:
        next_token = None
    retained = filter_videos(items, params)
    response = SearchResponse(
        next_page_token=next_token,
        next_page_signature=continuation_signature(params, next_token, settings.api_key) if next_token else None,
        page_number=2 if params.page_token is not None else 1,
        items=retained, omitted_count=omitted, examined_count=len(items),
        retained_count=len(retained), filtered_out_count=len(items) - len(retained),
        daily_limit=settings.daily_limit, searches_remaining=remaining,
    )
    if repeated_token:
        response.notice += " Jeton de continuation répété : parcours arrêté."
    return response
