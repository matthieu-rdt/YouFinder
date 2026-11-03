# Validation du squelette

Date : 2026-11-01.

## Environnement

Hôte Linux ARM64, Python 3.11.2 ; environnement Python isolé dans `/tmp/youfinder-venv`. Node 24.22.2 téléchargé depuis nodejs.org dans `/tmp`, archive ARM64 vérifiée par SHA-256. Aucun outil système installé. Docker absent du `PATH`.

## Vérifications réellement exécutées

| Commande | Résultat |
| --- | --- |
| `/tmp/youfinder-venv/bin/python -m pytest backend -q` | 2 tests réussis, sans avertissement après adaptation du client HTTPX |
| `npm test`, depuis `frontend/` | 2 tests réussis, sans avertissement après déclaration des modules ESM |
| `npm run typecheck`, depuis `frontend/` | Réussi : types de routes générés, puis TypeScript sans erreur |
| `npm run build -- --webpack`, depuis `frontend/` | Réussi : compilation, types et génération de l'accueil statique |
| `pip check`, dans l'environnement Python isolé | Aucune dépendance incompatible détectée |
| Lecture de `compose.yaml` avec PyYAML disponible sur l'hôte | YAML valide, services `frontend` et `backend` présents ; vérification syntaxique uniquement |
| API Docker Hub pour les tags retenus | Tags trouvés, digests enregistrés dans `versions.json` et les Dockerfiles |
| `git check-ignore` | `.env`, caches et dépendances ignorés ; `.env.example` reste versionnable |

## Échecs et limites

- Le premier runtime Node téléchargé était x64 ; il a été remplacé par ARM64.
- Une tentative d'installation npm a échoué par saturation de `/tmp`. L'installation a ensuite réussi avec le cache sur la partition du projet.
- Le premier client backend synchrone restait bloqué en sandbox. Une exécution hors sandbox a passé les tests avec un avertissement de dépréciation. Les tests utilisent finalement HTTPX avec transport ASGI asynchrone et passent en sandbox sans avertissement.
- Une commande de build lancée par erreur à la racine a échoué faute de `package.json` ; les commandes de build suivantes ont été exécutées dans `frontend/`.
- `npm run build` avec Turbopack échoue sur l'ouverture d'un port local, même après autorisation d'exécution hors sandbox. Le build Webpack réussit ; Turbopack n'est pas validé ici.
- Une tentative de régénération hors ligne du lockfile npm a échoué faute d'un paquet optionnel en cache. Le lockfile livré provient de l'installation npm réseau réussie ; les modifications ultérieures des scripts et du mode ESM ne changent pas les dépendances.
- Docker Compose, les images construites, le rechargement automatique et le proxy HTTP réel n'ont pas été testés. Les digests ont été vérifiés via l'API du registre, sans téléchargement des images.
- Les tests Python ont été exécutés sous 3.11.2, pas sous Python 3.13.18 de l'image.
- Aucun navigateur n'a été lancé pour une inspection visuelle.

## Vérification suivante sur une machine Docker

Suivre le README : `docker compose config --quiet`, puis `docker compose up --build`, tests dans les conteneurs et `curl --fail http://localhost:3000/api/health`. Le résultat attendu du dernier appel est `{"status":"ok"}` ; ce résultat n'a pas été observé ici via le proxy.

Aucun commit, push, déploiement OVH ou appel à YouTube n'a été effectué.

# Validation de la phase 2 — YouTube Data API v3

Date : 2026-11-02. Ces résultats concernent la phase 2 ; les résultats historiques ci-dessus sont conservés.

## Environnement et commandes observées

Hôte Linux ARM64, Python 3.11.2. Environnement Python isolé recréé dans `/tmp/youfinder-venv` avec les versions de `backend/requirements.lock`. Runtime Node 24.22.2 ARM64 téléchargé depuis nodejs.org et archive vérifiée avec le SHA-256 officiel. Aucune dépendance projet, version d’image ou lockfile modifié.

| Vérification | Résultat observé |
| --- | --- |
| `/tmp/youfinder-venv/bin/python -m pytest backend -q` | **52 tests réussis** ; exécution finale hors sandbox |
| `npm test`, dans `frontend/` avec Node 24.22.2 | **13 tests réussis**, 3 fichiers |
| `npm run typecheck` | Réussi |
| `npm run build -- --webpack` | Réussi après les changements finaux, accueil et pages conditions/confidentialité générés |
| `pip check` | Aucune dépendance incompatible |
| `docker compose config --quiet` | Réussi |
| `python3 scripts/check-compose-env.py` | Réussi : sentinelle fictive injectée uniquement au backend ; plafond configurable résolu à 7 ; aucun autre service ajouté |
| `git check-ignore backend/.state/search-quota.json .env` | Les deux chemins sont ignorés |
| Inspection du logo officiel téléchargé | Image lisible sur fond sombre, sans modification de son contenu |

Le test Compose vérifie la résolution déclarative des variables, sans afficher la configuration ni la clé réelle. Il ne prouve pas l’environnement d’un conteneur lancé.

## Couverture ajoutée

- Clé absente : erreur contrôlée, aucun appel Google, aucun compteur consommé, santé indépendante.
- Paramètres : mot-clé vide/trop long, espaces, dates invalides/sans fuseau/inversées, rejet des timestamps numériques et paramètres inconnus ; dates valides transmises en UTC.
- Recherche vide, limite de dix résultats et absence de pagination, enrichissement groupé, ordre préservé malgré l’ordre différent des détails, vidéo retirée et chaîne absente.
- Statistiques absentes/masquées, zéro réel, grands entiers, durées ISO avec jours/heures/minutes/secondes, direct sans durée définitive.
- Erreurs HTTP Google, clé/API refusée, quota épuisé, limitation de fréquence, réponse JSON invalide, dépassement de délai et erreur de connexion, sans retry ni fuite du message Google.
- Plafond interne : 21e tentative bloquée, plafond configurable/zéro, persistance entre instances du compteur, minuit Europe/Paris, quarante réservations concurrentes pour vingt places, stockage corrompu/inaccessible bloquant les appels.
- Client HTTPX réel configuré via les dépendances FastAPI, appels interceptés par MockTransport : clé uniquement dans l’en-tête sortant, absente des URL, logs capturés, réponses et OpenAPI.
- Frontend : aucune requête au montage/remontage, acceptation préalable, soumission avec dates UTC, doubles soumissions bloquées, résultats/vides/erreurs, aucun retry, ordre reçu conservé et données manquantes explicites.

Toutes les réponses YouTube des tests sont simulées avec `httpx.MockTransport`. Aucun appel à Google n’a été effectué avec une vraie clé ; aucun quota Google consommé volontairement.

## Limites et vérifications non réalisées

- `docker compose ps --format json` échoue : accès refusé au socket `/var/run/docker.sock`, y compris après autorisation d’exécution hors sandbox. Compose CLI est disponible (version 5.6.1), mais le daemon reste inaccessible à cet utilisateur.
- Aucun conteneur construit/démarré/recréé, aucune vérification d’injection dans un conteneur réel et aucun test réseau réel du proxy Next.js → FastAPI pendant cette phase.
- `npm run build` avec Turbopack échoue sur `binding to a port: Operation not permitted`, en sandbox puis après autorisation hors sandbox. Webpack réussit ; cela ne valide pas Turbopack.
- Une répétition des tests backend en sandbox est restée bloquée sans sortie et a été interrompue ; l’exécution finale hors sandbox réussit (52 tests).
- Les tests Python tournent sous 3.11.2, pas sous Python 3.13.18 des images. Aucun navigateur graphique ou test visuel interactif lancé.
- Pas de recherche Google réelle : validité d’une future clé, restrictions de clé, allocation effective de quota et réponses réelles restent à vérifier localement.
- Aucun commit, push, déploiement, accès OVH ou suppression de volume Docker.

## Vérification suivante sur la machine locale autorisée à utiliser Docker

1. Renseigner la clé dans `.env`, puis lancer `docker compose config --quiet` et `python3 scripts/check-compose-env.py`.
2. Démarrer avec `docker compose up --build` puis exécuter les tests du README.
3. Sans afficher la clé, vérifier les variables dans les services :

```bash
docker compose exec backend python -c 'import os; assert os.environ.get("YOUTUBE_API_KEY"); assert os.environ.get("YOUTUBE_DAILY_SEARCH_LIMIT"); print("Variables backend présentes")'
docker compose exec frontend node -e 'if (process.env.YOUTUBE_API_KEY) process.exit(1); console.log("Clé absente du frontend")'
```

4. Vérifier `/api/health` via le port 3000, puis effectuer une recherche manuelle. Elle consommera une tentative interne et du quota Google.
5. Rafraîchir l’accueil : aucun résultat n’est automatiquement rechargé et aucune nouvelle recherche ne doit partir. Vérifier dans les outils réseau que la clé n’apparaît pas dans les requêtes ou réponses navigateur.

Ne pas afficher `env`, `printenv` ou la sortie complète de `docker compose config` pour partager un diagnostic. Ne supprimer ni `.state` ni les volumes pour réinitialiser les essais.


## Phase 3 — filtres avancés, 2026-11-03

Implémentation : `backend/app/schemas.py`, `backend/app/youtube.py`, `backend/app/filters.py` (nouveau), `backend/app/routes/videos.py`, `frontend/src/lib/youtube.ts`, `frontend/src/components/video-search.tsx`.
Tests : `backend/tests/test_filters.py` (nouveau), `backend/tests/test_search.py`, `backend/tests/test_youtube.py`, `frontend/tests/search.test.tsx`.
Documentation : `README.md`, `docs/youtube-api.md`, `docs/architecture.md`, ce document.

Vérifications réellement exécutées sur Debian ARM64 :

- `/tmp/youfinder-venv/bin/python -m pytest backend -q` : **88 tests réussis**, Python 3.11.2, dépendances du `requirements.lock` existant installées dans un environnement temporaire.
- Depuis `frontend/`, avec Node 24.22.2 ARM64 dans le PATH : `npm test` : **16 tests réussis dans 3 fichiers**.
- Depuis une copie temporaire du frontend dans `/tmp/youfinder-phase3-frontend`, avec les dépendances existantes liées et la télémétrie désactivée : `npm run typecheck` : **réussi**.
- Dans cette même copie : `npm run build` : **échec Turbopack** car les dépendances liées sont hors de sa racine de résolution. Aucun changement de configuration projet pour contourner cette contrainte.
- `npm run build -- --webpack` dans cette copie : **réussi**, compilation, TypeScript et génération des pages statiques. Le cache `.next` du projet en cours n’a pas été modifié par ces vérifications.

Les tests couvrent les seuils inclusifs, zéro, valeurs absentes/inexploitables, abonnés masqués, arrondi public sans reconstruction, grands entiers, logique ET et ordre, jours/heures/minutes/secondes, directs et programmations, distinction durée inconnue/zéro, paramètres invalides sans consommation de quota, compteurs, conservation du formulaire après réponse vide et erreur, et absence de paramètres pour les champs vides. Le test d’intégration des filtres confirme trois appels groupés et une seule tentative interne consommée.

Limites : le premier essai Python système a échoué faute de HTTPX ; il a été remplacé par l’environnement temporaire ci-dessus. Docker refuse l’accès à son socket, y compris après tentative autorisée ; tests dans les images et chemin Compose non vérifiés. Le build Turbopack par défaut reste à vérifier avec des dépendances locales à sa racine. Aucun test visuel dans un navigateur, aucune requête Google réelle ni validation de clé/quota réel. Python de test 3.11.2, et non 3.13.18 des images.

Aucun nouveau package dans les manifestes ou lockfiles, modification de quota, appel YouTube supplémentaire, déploiement, accès OVH ou modification/suppression de volume Docker. Aucun secret lu ou affiché. Les résultats demeurent limités aux dix premiers résultats par pertinence ; les compteurs ne mesurent pas un potentiel de niche.


## Correction du filtre de dates — 2026-11-03

Diagnostic : absence de contrôle temporel sur `videos.list.snippet.publishedAt` après enrichissement. Reproduction simulée avant correction : vidéo de novembre retenue pour juin/juillet ; après correction : exclue. La présence initiale de l’identifiant dans la réponse réelle n’est pas expliquée sans les échanges HTTP d’origine.

Vérifications réellement exécutées :

- `/tmp/youfinder-venv/bin/python -m pytest backend -q` : **116 tests réussis**, Python 3.11.2.
- `npm test` depuis `frontend/` avec Node 24.22.2 ARM64 : **27 tests réussis dans 4 fichiers**.
- `npm run typecheck` : **réussi** dans une copie temporaire isolée avec dépendances locales. Premier essai de cette copie en échec à cause des liens d’exécutables déréférencés ; restauration des liens dans la copie puis réussite.
- `npm run build` : **réussi avec Turbopack**, dans cette même copie, sans modifier le cache du projet en cours.
- `git diff --check` : réussi.

Couverture : bornes UTC inclusives/exclusives, période du 01/06/2026 au 07/07/2026, dates enrichies hors période, inconnues ou invalides, fuseaux, filtres combinés, paramètres Google, ordre, compteurs et trois appels groupés pour une seule tentative réservée. Aucun appel Google réel ni essai visuel navigateur. Aucun essai Compose pendant cette correction, aucun volume modifié, accès OVH ou déploiement. Rapport détaillé : [[codex-reports/fix-date-filter]].


## Recette manuelle — Filtres avancés et dates UTC

**Source : vérifications manuelles rapportées par l’utilisateur**, après application dans Docker Compose du correctif décrit dans [le rapport de correction](codex-reports/fix-date-filter.md). L’incident de référence est [« Filtrage temporel incomplet après enrichissement — 2026-11-03 »](incidents.md#filtrage-temporel-incomplet-après-enrichissement--2026-11-03).

Environnement rapporté : Debian 12 ARM64 sous UTM, Docker Compose v2, frontend Next.js et backend FastAPI. Accès depuis un navigateur macOS via `localhost:3000`.

Plusieurs recherches similaires ont été effectuées manuellement après correction. **Aucune nouvelle incohérence de dates n’a été observée. La validation fonctionnelle manuelle est satisfaisante sur les recherches effectuées.** Le nombre exact de recherches, les mots-clés et les résultats précis ne sont pas consignés.

**Tests automatisés rapportés par Codex :** les résultats pytest, Vitest, TypeScript et build restent ceux déjà consignés ci-dessus et dans [le rapport de phase 3](codex-reports/phase-03.md) et [le rapport du correctif](codex-reports/fix-date-filter.md). Ils sont distincts de cette recette utilisateur ; aucune nouvelle exécution ni aucun nouveau résultat automatisé ne sont ajoutés ici.

**Vérifications non effectuées ou non attestées :**

- Aucun test automatisé, build ou nouvelle recherche YouTube n’a été lancé par Codex pour cette mise à jour documentaire ; aucun quota Google consommé par cette tâche.
- Ce compte rendu utilisateur n’atteste pas d’une exécution des suites automatisées dans les conteneurs Docker.
- Toutes les combinaisons de filtres et tous les cas limites n’ont pas fait l’objet d’une recette manuelle exhaustive. Cette observation ne vaut pas validation exhaustive de YouFinder.
- L’origine exacte de la présence de l’identifiant dans la réponse de recherche initiale reste non établie, comme indiqué dans le rapport du correctif.

Les limites historiques ci-dessus décrivent les vérifications effectuées par Codex à leur date ; cette recette utilisateur les complète sans les remplacer.
