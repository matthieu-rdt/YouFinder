"""Vérifie l'injection Compose avec une sentinelle fictive, sans afficher les secrets."""

import json
import os
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sentinel = "simulated-compose-key-not-a-secret"
environment = {**os.environ, "YOUTUBE_API_KEY": sentinel, "YOUTUBE_DAILY_SEARCH_LIMIT": "7"}
result = subprocess.run(
    ["docker", "compose", "--env-file", "/dev/null", "config", "--format", "json"],
    cwd=root, env=environment, capture_output=True, text=True,
)
if result.returncode:
    raise SystemExit("Échec de la résolution Compose ; aucune configuration affichée.")
config = json.loads(result.stdout)
backend = config["services"]["backend"]["environment"]
assert backend["YOUTUBE_API_KEY"] == sentinel
assert backend["YOUTUBE_DAILY_SEARCH_LIMIT"] == "7"
frontend = config["services"]["frontend"]
assert "YOUTUBE_API_KEY" not in frontend.get("environment", {})
assert sentinel not in json.dumps(frontend)
assert "NEXT_PUBLIC_YOUTUBE_API_KEY" not in json.dumps(config)
assert set(config["services"]) == {"frontend", "backend"}
print("Compose : clé injectée uniquement au backend ; plafond configurable vérifié (sentinelle fictive).")
