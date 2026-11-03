"""Compteur local durable. Linux : verrou interprocessus + remplacement atomique."""

import fcntl
import json
import os
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from app.errors import SearchError


class DailyQuota:
    def __init__(self, path: Path, limit: int):
        self.path = path
        self.limit = limit

    def reserve(self, now: datetime | None = None) -> int:
        """Réserve avant l'appel Google ; les tentatives échouées restent comptées."""
        today = (now or datetime.now(ZoneInfo("Europe/Paris"))).astimezone(ZoneInfo("Europe/Paris")).date().isoformat()
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            with self.path.with_suffix(".lock").open("a") as lock:
                fcntl.flock(lock, fcntl.LOCK_EX)
                count = 0
                if self.path.exists():
                    state = json.loads(self.path.read_text())
                    # Ne jamais réinitialiser silencieusement un fichier corrompu.
                    if (not isinstance(state, dict) or not isinstance(state.get("date"), str)
                            or type(state.get("count")) is not int or state["count"] < 0):
                        raise ValueError
                    datetime.strptime(state["date"], "%Y-%m-%d")
                    if state["date"] > today:
                        raise ValueError
                    if state["date"] == today:
                        count = state["count"]
                if count >= self.limit:
                    raise SearchError(429, "daily_limit_reached", "Plafond quotidien YouFinder atteint. Réessayez après minuit (Europe/Paris).")
                temporary = self.path.with_suffix(".tmp")
                with temporary.open("w") as output:
                    json.dump({"date": today, "count": count + 1}, output)
                    output.flush()
                    os.fsync(output.fileno())
                os.replace(temporary, self.path)
                return self.limit - count - 1
        except (OSError, ValueError, TypeError):
            raise SearchError(503, "quota_storage_unavailable", "Le compteur de recherches est indisponible. Recherche bloquée par précaution.") from None
