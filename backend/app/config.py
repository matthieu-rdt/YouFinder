import os
from dataclasses import dataclass, field
from pathlib import Path

from app.errors import SearchError


@dataclass(frozen=True)
class Settings:
    api_key: str = field(repr=False)
    daily_limit: int = 20
    quota_path: Path = Path(__file__).resolve().parents[1] / ".state/search-quota.json"


def get_settings() -> Settings:
    try:
        limit = int(os.environ.get("YOUTUBE_DAILY_SEARCH_LIMIT", "20"))
        if limit < 0:
            raise ValueError
    except ValueError:
        raise SearchError(503, "configuration_error", "Configuration du plafond de recherche invalide.") from None
    return Settings(api_key=os.environ.get("YOUTUBE_API_KEY", "").strip(), daily_limit=limit)
