from datetime import datetime, timezone
import re

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.dates import parse_rfc3339_utc


class SearchParams(BaseModel):
    """Paramètres de recherche et filtres appliqués après enrichissement."""

    model_config = ConfigDict(extra="forbid")
    q: str = Field(min_length=1, max_length=200)
    published_after: datetime | None = Field(default=None, description="Borne de publication inclusive, RFC 3339 avec fuseau, normalisée en UTC.")
    published_before: datetime | None = Field(default=None, description="Borne de publication exclusive, RFC 3339 avec fuseau ; lendemain à 00:00 UTC pour inclure un jour entier.")

    min_views: int | None = Field(default=None, ge=0)
    max_subscribers: int | None = Field(default=None, ge=0)
    min_duration_minutes: int | None = Field(default=None, ge=0)

    @field_validator("min_views", "max_subscribers", "min_duration_minutes", mode="before")
    @classmethod
    def require_integer(cls, value):
        if value is None or type(value) is int:
            return value
        if isinstance(value, str) and re.fullmatch(r"[0-9]+", value):
            return value
        raise ValueError("Entier positif ou nul obligatoire.")

    @field_validator("published_after", "published_before", mode="before")
    @classmethod
    def require_rfc3339(cls, value):
        return parse_rfc3339_utc(value) if isinstance(value, str) else value

    @field_validator("q", mode="before")
    @classmethod
    def trim_query(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value

    @field_validator("published_after", "published_before")
    @classmethod
    def require_timezone(cls, value: datetime | None) -> datetime | None:
        if value is not None and (value.tzinfo is None or value.utcoffset() is None):
            raise ValueError("Le fuseau horaire est obligatoire.")
        return value.astimezone(timezone.utc) if value is not None else None

    @model_validator(mode="after")
    def date_order(self):
        if self.published_after and self.published_before and self.published_after >= self.published_before:
            raise ValueError("La borne de début doit précéder strictement la borne de fin exclusive.")
        return self


class Video(BaseModel):
    id: str
    title: str | None
    thumbnail_url: str | None
    channel_id: str | None
    channel_title: str | None
    channel_url: str | None
    published_at: str | None
    view_count: str | None
    subscriber_count: str | None
    subscribers_hidden: bool | None
    duration_iso: str | None
    duration_label: str | None
    broadcast_status: str | None
    youtube_url: str


class SearchResponse(BaseModel):
    items: list[Video]
    omitted_count: int = 0
    examined_count: int
    retained_count: int
    filtered_out_count: int
    daily_limit: int
    searches_remaining: int
    notice: str = "Filtrage des 10 premiers résultats maximum par pertinence, sans pagination ni remplacement des vidéos écartées. Ces résultats ne représentent pas une analyse exhaustive de YouTube."
