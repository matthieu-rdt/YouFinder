"""Sélection locale sur les seules données publiques, sans estimation."""
from app.dates import parse_rfc3339_utc
from app.schemas import SearchParams, Video
from app.youtube import duration_seconds, public_count


def matches_filters(video: Video, params: SearchParams) -> bool:
    if params.published_after is not None or params.published_before is not None:
        if video.published_at is None:
            return False
        try:
            published = parse_rfc3339_utc(video.published_at)
        except ValueError:
            return False  # Une date inconnue ne peut pas satisfaire une période demandée.
        if params.published_after is not None and published < params.published_after:
            return False
        if params.published_before is not None and published >= params.published_before:
            return False
    if params.min_views is not None:
        views = public_count(video.view_count)
        if views is None or int(views) < params.min_views:
            return False
    if params.max_subscribers is not None:
        subscribers = public_count(video.subscriber_count)
        # Comparaison du nombre public arrondi uniquement ; aucune reconstruction.
        if video.subscribers_hidden is True or subscribers is None or int(subscribers) > params.max_subscribers:
            return False
    if params.min_duration_minutes is not None:
        seconds = duration_seconds(video.duration_iso)
        if video.broadcast_status in ("live", "upcoming") or seconds is None or seconds < params.min_duration_minutes * 60:
            return False
    return True


def filter_videos(items: list[Video], params: SearchParams) -> list[Video]:
    return [video for video in items if matches_filters(video, params)]
