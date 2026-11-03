"""Lecture stricte des instants RFC 3339, toujours normalisés en UTC."""
import re
from datetime import datetime, timezone


def parse_rfc3339_utc(value: str) -> datetime:
    if not re.fullmatch(
        r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}"
        r"(?:\.[0-9]+)?(?:Z|[+-][0-9]{2}:[0-5][0-9])", value
    ):
        raise ValueError("Date RFC 3339 avec fuseau obligatoire.")
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)
    except (ValueError, OverflowError):
        raise ValueError("Date RFC 3339 invalide.") from None
