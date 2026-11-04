# Décision initiale — monorepo de développement

Date : 2026-11-01. Statut : structure validée par l'utilisateur.

## Contexte

Projet personnel pédagogique : apprendre Python/FastAPI et TypeScript/React sans multiplier les composants avant leur utilité.

## Décisions

Le monorepo rassemble frontend, backend et configuration Compose. Une évolution peut être revue dans un même diff Git. Aucun service PostgreSQL n'est ajouté tant qu'aucune fonctionnalité ne nécessite de persistance.

Le navigateur accède à Next.js sur le port 3000. Next.js transmet `/api/*` à FastAPI via une réécriture. Dans Compose, l'adresse interne est `http://backend:8000` ; hors conteneurs elle est `http://127.0.0.1:8000`. Le nom DNS `backend` reste côté serveur. Ce trajet évite de configurer CORS à cette étape.

`/api/health` est un contrôle de vie. Son statut ne promet ni accès YouTube ni connexion à une base. Pydantic rend le contrat de réponse explicite et l'intègre dans OpenAPI.

Compose publie les ports sur `127.0.0.1` et utilise des montages de sources pour le rechargement. Les volumes frontend isolent les dépendances et le cache de l'hôte. Le démarrage exécute `npm ci` pour éviter un volume de dépendances obsolète après une mise à jour du lockfile.

Les images officielles Debian slim limitent les différences de bibliothèques système. Les tags précis et les digests multiarchitecture sont enregistrés dans les Dockerfiles. Ils ont été vérifiés via l'API Docker Hub ; cela ne remplace pas un build local. Les dépendances de test restent incluses dans les images de développement.

## Sécurité et périmètre

Aucun secret n'est requis. `.env` est ignoré ; seul `.env.example` est versionnable. Une future clé YouTube devra rester exclusivement dans le backend. Aucun contenu audiovisuel n'est téléchargé. Aucun service existant, volume ou serveur OVH n'est modifié.

Les images actuelles sont des outils de développement. Une étape de production devra traiter les utilisateurs non privilégiés, les builds optimisés, les secrets, HTTPS et l'exploitation, avec validation préalable.

## Sources des versions

- [Images Node officielles](https://github.com/docker-library/official-images/blob/master/library/node)
- [Images Python officielles](https://github.com/docker-library/official-images/blob/master/library/python)
- [Registre npm](https://registry.npmjs.org/)
- [Registre PyPI](https://pypi.org/)
- API Docker Hub : `/v2/namespaces/library/repositories/{image}/tags/{tag}`.

Les versions exactes retenues sont consignées dans `versions.json`. Ce dossier peut être ouvert dans Obsidian ; aucune configuration personnelle de coffre n'est imposée.

# Décision phase 2 — recherche officielle et compteur local

Date : 2026-11-02. Statut : intégration autorisée par l’utilisateur, plafond interne configurable de vingt tentatives par jour.

Le trajet `/api/*` existant est conservé. Aucun CORS supplémentaire, nouvelle dépendance, changement d’image, service PostgreSQL ou déploiement n’est introduit. Le nom affiché devient YouFinder, conformément au nom du projet et aux règles de marque YouTube.

Le backend sépare les paramètres/réponses Pydantic, l’accès HTTPX asynchrone, le routeur HTTP et le compteur quotidien. Les statistiques sont des chaînes décimales facultatives pour ne pas perdre de précision en JavaScript ; leur absence reste distincte de zéro. Les enrichissements sont groupés et l’ordre de recherche conservé. Les futurs filtres ne sont ni exposés ni implémentés.

Un compteur fichier est nécessaire pour conserver le plafond après redémarrage, sans base de données. Il utilise le montage backend déjà présent et n’ajoute pas de volume Docker. `flock` sérialise les réservations ; un fichier temporaire synchronisé puis remplacé atomiquement conserve uniquement date et compteur. Le jour est calculé en Europe/Paris, indépendamment du quota Google. La recherche échoue si le compteur ne peut être lu ou écrit. Ce choix convient à une instance personnelle sur Linux ; plusieurs serveurs indépendants exigeraient un compteur partagé.

La clé est injectée uniquement dans l’environnement backend et envoyée à Google par en-tête HTTPS pour éviter son inclusion dans les URL HTTPX. Les réponses d’erreur publiques sont construites localement et ne contiennent pas les réponses Google. Le formulaire n’utilise aucun effet de chargement, aucune récupération serveur de résultats et aucun stockage navigateur : rafraîchir l’accueil ne relance pas une recherche.

Les détails, compromis, codes d’erreur et sources officielles sont dans [[youtube-api]]. La validation effective est consignée dans [[validation]].


# Décision phase 3 — filtrage après enrichissement

Date : 2026-11-03. Statut : plan et implémentation autorisés par l’utilisateur.

Les filtres sont des fonctions pures dans `backend/app/filters.py`, appliquées par le routeur après les appels groupés existants. Aucune modification du compteur quotidien ni du transport YouTube. `duration_seconds` centralise la conversion d’unité, également utilisée par le libellé. Une durée inconnue reste distincte de zéro ; directs et diffusions programmées n’ont pas de durée finale utilisable pour ce filtre.

Le maximum d’abonnés compare seulement la valeur publique arrondie vers le bas à trois chiffres significatifs. Une valeur masquée ou absente ne satisfait pas un seuil actif. Aucun nombre exact n’est reconstruit. Les trois filtres se combinent par ET avec bornes inclusives ; les statistiques restent des chaînes dans le contrat JSON.

Les compteurs de traitement distinguent vidéos examinées, retenues, écartées et indisponibles. Le filtrage reste limité à dix résultats de pertinence, sans remplacement ni appel supplémentaire. Les champs du formulaire conservent naturellement leurs valeurs après soumission ; aucun stockage navigateur ajouté. Détails dans [[youtube-api]], vérifications dans [[validation]].


# Décision phase 4 — deux pages manuelles et critères liés au jeton

Date : 2026-11-04. Statut : implémentation autorisée sur `feat/youtube-pagination`, recette manuelle restante.

Le flux réseau et les services existants sont conservés. `search.list` demande désormais 50 résultats. Une requête traite une seule page, enrichie par lots puis filtrée avec les règles existantes, y compris le contrôle final des dates UTC. Aucun remplissage automatique des exclusions.

Le frontend conserve l’instantané soumis, un verrou immédiat de requête et une limite de deux pages réussies. Le formulaire et la continuation sont bloqués pendant une requête, empêchant une réponse concurrente de remplacer une nouvelle recherche. La liste fusionne les pages dans l’ordre et conserve la première occurrence de chaque identifiant ; les compteurs cumulés restent distincts des vidéos uniques affichées.

Pour refuser un jeton associé à des critères modifiés et ne pas autoriser une troisième page côté backend, une signature HMAC-SHA256 couvre les critères normalisés et le jeton opaque. Seule une réponse de première page délivre cette signature ; la deuxième ne délivre aucune continuation. La clé backend existante sert au HMAC sans être transmise au navigateur, et une rotation de clé invalide les continuations. Aucun stockage de jeton ni nouvelle dépendance n’est ajouté. Le mécanisme ne rend pas la continuation à usage unique ; une reprise manuelle est une tentative supplémentaire et ne progresse pas vers une troisième page autorisée.

Les erreurs de continuation préservent résultats et compteurs acquis. Le solde quotidien est la dernière valeur connue, potentiellement périmée après erreur. Le plafond et son fichier durable sont inchangés. Détails du contrat dans [[youtube-api]], preuves dans [[validation]] et [[codex-reports/phase-04]].
