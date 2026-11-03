# Intégration YouTube Data API v3 — phases 2 et 3

Date : 2026-11-02. Périmètre validé : recherche personnelle, dix résultats, dates de publication, statistiques publiques et plafond interne de vingt tentatives/jour configurable.

## Flux et contrat

Navigateur → Next.js `/api/*` → FastAPI → `https://www.googleapis.com/youtube/v3/`.

`GET /api/videos/search?q=python&published_after=2026-01-01T00:00:00Z&published_before=2026-02-01T23:59:59.999Z`

`q` est obligatoire (1–200 caractères après suppression des espaces périphériques). Les dates doivent être RFC 3339 avec fuseau horaire et ordonnées. Les paramètres supplémentaires sont refusés. L’interface utilise des jours UTC avec fin de journée incluse. Aucun appel au montage de la page : seul le gestionnaire de soumission déclenche `fetch`, avec `cache: no-store`. Le backend ajoute `Cache-Control: no-store` aux réponses de recherche.

1. `search.list(part=snippet,type=video,maxResults=10,order=relevance,q=...)`, avec les dates éventuelles.
2. `videos.list(part=snippet,statistics,contentDetails,id=...)` pour tous les identifiants de cette page.
3. `channels.list(part=statistics,id=...)` pour les identifiants de chaînes dédupliqués.

Pas de suivi de `nextPageToken`, pas d’appel par vidéo ou par chaîne. Pas d’enrichissement si la recherche est vide. L’assemblage préserve l’ordre initial de recherche, même si Google retourne les détails dans un ordre différent. Les vidéos absentes de `videos.list` sont omises et comptées dans `omitted_count`. Un échec d’enrichissement rend une erreur explicite et non un faux résultat vide.

La réponse comprend `items`, `omitted_count`, `daily_limit`, `searches_remaining` et un avertissement sur la non-exhaustivité. Les statistiques restent des chaînes décimales afin de préserver les grands entiers au passage vers JavaScript ; `null` signifie indisponible. `subscribers_hidden` distingue un nombre masqué d’une donnée manquante. La durée ISO originale est accompagnée d’un libellé de présentation (conversion d’unité uniquement). Pour les directs en cours ou programmés, le libellé de durée reste nul et l’état est affiché.

## Quotas et comportement d’erreur

La documentation Google consultée le 2026-11-02 décrit un quota distinct de 100 appels `search.list` par jour, chaque appel consommant une unité de ce quota. Les autres endpoints partagent par défaut 10 000 unités/jour ; `videos.list` et `channels.list` valent chacun une unité. Une recherche complète consomme donc un appel de recherche et au plus deux unités du quota commun. Vérifier les allocations du projet dans Google Cloud ; ne pas supposer que le plafond interne représente le quota Google restant. La remise à zéro Google suit minuit heure du Pacifique.

Le plafond **interne** est partagé par l’installation locale : `YOUTUBE_DAILY_SEARCH_LIMIT=20`, journée Europe/Paris. La réservation durable se fait avant tout appel Google. Une tentative échouée reste comptée ; absence de clé ou paramètres invalides ne comptent pas. `0` bloque les recherches. Un verrou `flock` protège les réservations entre threads/processus partageant le même fichier. Le fichier n’enregistre aucune requête ni donnée YouTube. Une corruption, un jour stocké dans le futur ou une erreur d’écriture bloque la recherche. Une restauration d’ancienne sauvegarde ou suppression manuelle du fichier peut rétablir un ancien compteur : ce n’est pas un dispositif de facturation ni une limite distribuée.

| HTTP YouFinder | Code stable | Cas |
| --- | --- | --- |
| 422 | `invalid_parameters` | Paramètres invalides |
| 503 | `youtube_not_configured` | Clé absente |
| 503 | `configuration_error` | Plafond invalide |
| 503 | `quota_storage_unavailable` | Compteur local inaccessible/corrompu |
| 429 | `daily_limit_reached` | Plafond interne atteint |
| 429 | `youtube_quota_exceeded` | Quota Google épuisé |
| 429 | `youtube_rate_limited` | Limitation de fréquence Google |
| 503 | `youtube_access_denied` | Clé/API refusée |
| 504 | `youtube_timeout` | Délai HTTPX dépassé |
| 502 | `youtube_unavailable` | Erreur réseau |
| 502 | `youtube_http_error` | Autre erreur HTTP Google |
| 502 | `youtube_invalid_response` | JSON ou structure inexploitable |

Erreurs au format `{"error":{"code":"...","message":"..."}}`. Aucun corps d’erreur Google, URL de requête ou détail d’exception n’est transmis. HTTPX ne suit pas les redirections et n’effectue aucun retry. Délais : connexion 5 secondes et autres opérations réseau 10 secondes, par appel (jusqu’à trois appels successifs). Une nouvelle soumission manuelle reste possible après une erreur ; elle est soumise au compteur.

## Clé et confidentialité

La clé est lue depuis l’environnement backend. Compose transmet explicitement la variable uniquement à ce service ; pas d’argument de build, pas de variable publique Next.js. Les appels Google utilisent l’en-tête HTTPS `X-Goog-Api-Key`, jamais le paramètre d’URL `key`. HTTPX journalise les URL sans cet en-tête ; aucune journalisation des en-têtes n’est ajoutée. Les tests utilisent une sentinelle fictive pour vérifier l’absence de clé dans URL, logs capturés, réponses et OpenAPI. Ne pas activer de journalisation externe des en-têtes ou partager l’environnement des conteneurs.

Pas de stockage applicatif des résultats, de cache durable, d’historique, de base de données ou de données simulées dans l’interface réelle. Les résultats restent en mémoire dans la page. Les miniatures utilisent directement les URL HTTPS de l’API, sans optimisation/cache Next.js ; le navigateur et les serveurs d’images peuvent appliquer leur propre cache. Les journaux d’accès techniques peuvent contenir les mots-clés et les dates.

Les règles Google imposent des limites de conservation des données publiques non autorisées par le propriétaire : trente jours au maximum, avec suppression ou actualisation selon les données et règles applicables. Cette phase évite la persistance de ces données. Toute future sauvegarde ou analyse devra être réévaluée avant ajout.

L’interface identifie YouTube comme source et utilise le logo officiel « Developed with YouTube », téléchargé sans modification depuis la page officielle de marque, conservé dans `frontend/public/developed-with-youtube.png`. Source : https://developers.google.com/static/youtube/images/developed-with-youtube-sentence-case-light.png. Le logo est distinct du nom YouFinder et renvoie vers YouTube. Les conditions et la politique de confidentialité sont accessibles, avec acceptation explicite avant recherche. Aucun lecteur intégré ni téléchargement audiovisuel.

## Évolutivité

`SearchParams` porte les paramètres autorisés actuellement. Le routeur gère HTTP et le plafond ; le client YouTube récupère et assemble les ressources ; le frontend présente le contrat typé. Cette séparation permet d’ajouter ultérieurement des paramètres et une étape de sélection, après étude de conformité et tests dédiés.

## Phase 3 — filtres validés le 2026-11-03

Trois paramètres facultatifs : `min_views`, `max_subscribers`, `min_duration_minutes`. Ce sont des entiers positifs ou nuls, écrits en chiffres décimaux ; absence = filtre désactivé, zéro = seuil actif. Les chaînes vides, fractions, signes et notations exponentielles sont refusés (422) avant réservation du quota.

Après les mêmes appels groupés, `filters.py` sélectionne les vidéos avec une logique ET et conserve leur ordre. Vues et durée utilisent un minimum inclusif ; abonnés un maximum inclusif. Le compteur public de `channels.list` est utilisé exclusivement. `hiddenSubscriberCount=true`, compteur absent ou invalide : exclusion si le filtre abonnés est actif. Le compteur public est arrondi vers le bas à trois chiffres significatifs : aucune reconstruction du nombre exact, aucune garantie sur un plafond du nombre réel.

`duration_seconds` centralise la conversion des durées ISO 8601 YouTube contenant jours, heures, minutes et secondes. Elle sert au libellé et au filtrage ; une durée inconnue reste `None`. Les directs en cours et programmés sont exclus lorsque le filtre durée est actif, même pour zéro minute.

La réponse ajoute `examined_count` (vidéos disponibles après enrichissement), `retained_count` (taille de `items`) et `filtered_out_count` (examinées moins retenues). `omitted_count` conserve son sens de vidéos devenues indisponibles. Ces compteurs décrivent le traitement de la requête, sans score ni métrique analytique de chaîne.

Exemple : `/api/videos/search?q=python&min_views=1000&max_subscribers=10000&min_duration_minutes=10`.

Les dix premiers résultats par pertinence seulement sont examinés, sans pagination ni remplacement. Aucun résultat ne prouve pas l’absence de vidéos correspondantes ailleurs. Le frontend affiche l’avertissement `notice` et conserve les critères après résultat ou erreur pendant la session de page, sans persistance navigateur. Aucun appel supplémentaire, modification du quota, package ajouté ou stockage des résultats. Shorts et tri restent hors périmètre.

## Sources officielles consultées

- [Recherche et filtres de publication](https://developers.google.com/youtube/data/reference/rest/v3/search/list)
- [Métadonnées, durée ISO 8601 et statistiques vidéo](https://developers.google.com/youtube/data/reference/rest/v3/videos)
- [Statistiques publiques des chaînes et arrondi des abonnés](https://developers.google.com/youtube/data/reference/rest/v3/channels)
- [Quotas actuels](https://developers.google.com/youtube/data/determine_quota_cost)
- [Erreurs API](https://developers.google.com/youtube/data/reference/rest/v3/errors)
- [Règles développeurs, confidentialité et conservation](https://developers.google.com/youtube/terms/developer-policies)
- [Attribution et règles de marque](https://developers.google.com/youtube/terms/branding-guidelines)
- [Utilisation des clés par en-tête](https://docs.cloud.google.com/docs/authentication/api-keys-use)
- [Protection des clés](https://docs.cloud.google.com/docs/authentication/api-keys-best-practices)
