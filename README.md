# YouFinder

Application personnelle d’apprentissage : recherche de vidéos publiques avec YouTube Data API v3, backend FastAPI et frontend Next.js. Cette phase ne comporte ni PostgreSQL ni déploiement de production.

## Configuration locale

Prérequis : Docker Engine et Docker Compose v2 ou supérieur, ports 3000 et 8000 disponibles. Les images Node et Python conservent leurs versions et digests explicites.

Si `.env` n’existe pas, le créer à partir de `.env.example` **sans écraser un fichier existant**. Dans `.env`, renseigner :

```dotenv
YOUTUBE_API_KEY=
YOUTUBE_DAILY_SEARCH_LIMIT=20
```

La valeur de la clé doit être saisie localement, jamais dans Git ou dans la conversation. Activer **YouTube Data API v3** dans un projet Google Cloud ; créer une clé restreinte à cette API. Une restriction par adresse IP sortante peut être ajoutée si cette IP est stable. Une restriction par référent de navigateur ne convient pas à ces appels backend.

Compose lit `.env` et injecte ces deux variables uniquement dans le backend. Le frontend reçoit seulement l’adresse interne du backend et le réglage de télémétrie Next.js. Ne jamais créer de variable `NEXT_PUBLIC_*` contenant une clé. Ne pas partager la sortie de `docker compose config` sans `--quiet` : elle peut contenir les secrets résolus.

```bash
docker compose config --quiet
python3 scripts/check-compose-env.py
docker compose up --build
```

Le script vérifie l’injection Compose à l’aide d’une sentinelle fictive, sans afficher la configuration ni utiliser votre clé. Le démarrage recrée si nécessaire les conteneurs de développement ; les volumes nommés existants sont conservés. Après un changement de `.env`, `docker compose restart` seul ne recharge pas les variables : utiliser `docker compose up -d backend`.

- Application : http://localhost:3000
- Santé via le proxy : http://localhost:3000/api/health
- Documentation backend : http://localhost:8000/docs

Sans clé, `/api/health` fonctionne et une recherche renvoie une erreur explicite de configuration. Aucune requête YouTube ne part au chargement ou au rafraîchissement de l’accueil. Accepter la politique de confidentialité et les conditions, saisir le mot-clé et éventuellement les dates, puis soumettre le formulaire.

```bash
docker compose stop
```

Cette commande conserve les volumes. Ne jamais utiliser `down -v`.

## Recherche et limites

- Jusqu’à **10 résultats**, sans pagination, dans l’ordre de pertinence retourné par YouTube. Ce n’est pas une analyse exhaustive de la plateforme.
- Bornes de publication facultatives : début inclus à 00:00 UTC, fin du jour sélectionné incluse via une borne exclusive au lendemain à 00:00 UTC. Contrôle final sur la date issue de `videos.list` : les vidéos hors période, ou à date absente/invalide lorsqu’une borne est demandée, sont écartées. Le quota interne utilise une autre convention : journée **Europe/Paris**.
- Titre, miniature, chaîne, publication, vues publiques, abonnés publics lorsqu’ils sont disponibles, durée fournie par l’API et liens YouTube.
- Les abonnés sont arrondis par YouTube. Une donnée absente est indiquée comme indisponible, jamais remplacée par zéro. Un zéro fourni par l’API reste un zéro.
- La durée API peut différer légèrement de la lecture réelle. Les directs en cours ou programmés affichent leur état, sans durée définitive.
- Une recherche peut renvoyer moins de dix vidéos. Les vidéos disparues entre recherche et enrichissement sont omises avec un avertissement.
- Filtres facultatifs combinés par ET : vues minimum, abonnés publics maximum, durée minimum en minutes entières. Zéro est un seuil explicite ; un champ vide désactive le filtre.
- Les seuils sont inclusifs. Une donnée manquante ou inexploitable exclut la vidéo uniquement si le filtre correspondant est actif. Les abonnés masqués sont exclus avec le filtre abonnés ; les directs en cours et programmés avec le filtre durée.
- Le nombre public d’abonnés est arrondi vers le bas à trois chiffres significatifs par YouTube : le filtre ne garantit pas un plafond sur le nombre réel exact, qui n’est jamais reconstruit.
- Affichage des vidéos examinées, retenues, écartées et des vidéos indisponibles omises. Seuls les dix premiers résultats de pertinence sont filtrés, sans remplacement des exclusions : un résultat vide ne démontre pas l’absence de vidéos correspondantes sur YouTube.
- Les critères restent dans le formulaire après résultat ou erreur, jusqu’au rechargement de la page. Aucun filtre Shorts, tri local ou métrique analytique dérivée.

Le plafond interne vaut **20 tentatives par jour**, partagé par toute l’application et configurable avec `YOUTUBE_DAILY_SEARCH_LIMIT` (entier positif ou nul ; zéro bloque les recherches). Chaque tentative réservée avant l’appel Google reste comptée, même si Google renvoie une erreur ou si la connexion échoue. Les entrées invalides et l’absence de clé ne consomment rien. Aucun retry automatique, aucune recherche à chaque frappe.

Le compteur contient uniquement une date et un nombre, dans `backend/.state/search-quota.json`, protégé par verrou Linux et écriture atomique. Il survit aux rechargements et recréations des conteneurs grâce au montage existant `./backend:/app`, sans nouveau volume Docker. Il est ignoré par Git et exclu du contexte de build. En cas de corruption ou d’accès impossible, la recherche est bloquée. Ne pas supprimer ce dossier pour contourner le plafond. Ce mécanisme vise une installation locale unique sur système de fichiers local, pas plusieurs serveurs indépendants.

Les quotas Google restent indépendants du plafond interne. Consulter leur allocation réelle dans la console Google Cloud. Voir [la documentation API et ses sources officielles](docs/youtube-api.md).

## Vérifications

Après démarrage :

```bash
docker compose exec backend python -m pytest -q
docker compose exec frontend npm test
docker compose exec frontend npm run typecheck
docker compose run --rm --no-deps --volume /app/.next frontend npm run build
curl --fail http://localhost:3000/api/health
```

Le build utilise un conteneur distinct et un volume temporaire pour ne pas modifier le cache `.next` du serveur en cours. Les volumes nommés existants ne sont pas supprimés.

Les tests backend utilisent `httpx.MockTransport` : aucune vraie clé ni consommation de quota Google. Ils couvrent aussi la validation, les erreurs et le compteur persistant concurrent. Les tests frontend utilisent des données entièrement simulées : aucune donnée fictive n’est affichée dans l’application réelle. Les commandes réellement exécutées et leurs limites sont consignées dans [docs/validation.md](docs/validation.md).

### Sans Docker

Utiliser Node **24.22.2** et Python **3.13.18** pour correspondre aux images ; le backend accepte Python 3.11 ou supérieur.

```bash
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.lock
backend/.venv/bin/python -m pytest backend -q
backend/.venv/bin/python -m uvicorn app.main:app --reload
```

Hors Compose, exporter les variables dans le terminal backend : FastAPI ne charge pas automatiquement le fichier `.env`. Dans un autre terminal, depuis `frontend/` :

```bash
npm ci
npm test
npm run typecheck
npm run build
npm run dev
```

Le proxy utilise par défaut `http://127.0.0.1:8000`. `BACKEND_INTERNAL_URL` change cette adresse côté serveur uniquement ; pour un build Next.js, définir cette variable dès la compilation.

## Organisation

- `backend/app/routes/videos.py` : validation HTTP, orchestration, réservation du quota.
- `backend/app/youtube.py` : client officiel HTTPX et assemblage des données publiques.
- `backend/app/schemas.py` : contrat de recherche et de réponse.
- `backend/app/quota.py` : compteur quotidien local.
- `frontend/src/components/` : formulaire explicite et cartes vidéo.
- `frontend/src/app/confidentialite/` et `conditions/` : informations utilisateur.
- `docs/architecture.md`, `docs/youtube-api.md`, `docs/incidents.md` : documentation ouvrable dans Obsidian.
- `docs/versions.json` : versions et digests vérifiés lors de la phase initiale, inchangés ici.

Aucune dépendance ajoutée. `package-lock.json` et `requirements.lock` restent inchangés. Aucun service OVH, Ansible ou PostgreSQL n’est modifié. La configuration actuelle reste destinée au développement local ; toute ouverture à d’autres utilisateurs ou mise en production demande une phase et une validation distinctes.
