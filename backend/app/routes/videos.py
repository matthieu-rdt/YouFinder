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


@router.get("/search", response_model=SearchResponse)
async def search_videos(
    params: Annotated[SearchParams, Query()],
    settings: Annotated[Settings, Depends(get_settings)],
    client: Annotated[httpx.AsyncClient, Depends(get_http_client)],
) -> SearchResponse:
    if not settings.api_key:
        raise SearchError(503, "youtube_not_configured", "La recherche YouTube n’est pas configurée côté backend.")
    remaining = await run_in_threadpool(DailyQuota(settings.quota_path, settings.daily_limit).reserve)
    items, omitted = await YouTubeClient(client).search(params)
    retained = filter_videos(items, params)
    return SearchResponse(
        items=retained, omitted_count=omitted, examined_count=len(items),
        retained_count=len(retained), filtered_out_count=len(items) - len(retained),
        daily_limit=settings.daily_limit, searches_remaining=remaining,
    )
