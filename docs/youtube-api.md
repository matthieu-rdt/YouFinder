# Intégration YouTube Data API v3 — phases 2 à 5

Mise à jour : 2026-11-04. Périmètre validé : recherche personnelle, deux pages manuelles de cinquante identifiants maximum chacune, dates de publication, statistiques publiques et plafond interne de vingt tentatives/jour configurable.

## Flux et contrat

Navigateur → Next.js `/api/*` → FastAPI → `https://www.googleapis.com/youtube/v3/`.

`GET /api/videos/search?q=python&published_after=2026-01-01T00:00:00Z&published_before=2026-02-02T00:00:00Z`

`q` est obligatoire (1–200 caractères après suppression des espaces périphériques). Les dates doivent être RFC 3339 avec fuseau horaire, normalisées en UTC. `published_after` est inclusif et `published_before` exclusif ; si les deux bornes sont présentes, le début doit strictement précéder la fin. Les paramètres supplémentaires sont refusés. L’interface inclut entièrement les jours UTC sélectionnés en envoyant le début à 00:00 UTC et le lendemain du dernier jour à 00:00 UTC comme fin exclusive. Aucun appel au montage de la page : seul le gestionnaire de soumission déclenche `fetch`, avec `cache: no-store`. Le backend ajoute `Cache-Control: no-store` aux réponses de recherche.

1. `search.list(part=snippet,type=video,maxResults=50,order=relevance,q=...)`, avec les dates éventuelles.
2. `videos.list(part=snippet,statistics,contentDetails,id=...)` pour tous les identifiants de cette page.
3. `channels.list(part=statistics,id=...)` pour les identifiants de chaînes dédupliqués.

Après enrichissement, le backend contrôle `videos.list.snippet.publishedAt` dans l’intervalle `[published_after, published_before[`, avant les autres critères. Les dates absentes, invalides ou sans fuseau sont exclues si une borne est active, et restent disponibles sans contrainte de période. Les exclusions temporelles font partie de `filtered_out_count`, sans modifier `omitted_count` (vidéos indisponibles), ni le nombre d’appels. `examined_count` reste le nombre de vidéos enrichies avant tous les filtres.

Google documente `publishedBefore` comme « avant ou à » la borne. Nous transmettons la borne du lendemain à la recherche et imposons strictement l’exclusion de cet instant au contrôle final. Les bornes de recherche sont décrites comme portant sur la création des ressources ; `videos.list.snippet.publishedAt` décrit la publication, pouvant différer du téléversement. Nous n’inférons pas une égalité entre les dates des deux ressources et ne remplaçons pas la date enrichie par celle de recherche.

Une page par requête applicative, avec continuation manuelle via `nextPageToken` puis `pageToken`. Aucun appel par vidéo ou par chaîne. Pas d’enrichissement si la recherche est vide. L’assemblage préserve l’ordre initial de recherche, même si Google retourne les détails dans un ordre différent. Les vidéos absentes de `videos.list` sont omises et comptées dans `omitted_count`. Un échec d’enrichissement rend une erreur explicite et non un faux résultat vide.

La réponse comprend `items`, `omitted_count`, `daily_limit`, `searches_remaining` et un avertissement sur la non-exhaustivité. Les statistiques restent des chaînes décimales afin de préserver les grands entiers au passage vers JavaScript ; `null` signifie indisponible. `subscribers_hidden` distingue un nombre masqué d’une donnée manquante. La durée ISO originale est accompagnée d’un libellé de présentation (conversion d’unité uniquement). Pour les directs en cours ou programmés, le libellé de durée reste nul et l’état est affiché.

## Quotas et comportement d’erreur

La documentation Google consultée le 2026-11-02 décrit un quota distinct de 100 appels `search.list` par jour, chaque appel consommant une unité de ce quota. Les autres endpoints partagent par défaut 10 000 unités/jour ; `videos.list` et `channels.list` valent chacun une unité. Une page complète consomme donc un appel de recherche et au plus deux unités du quota commun. Vérifier les allocations du projet dans Google Cloud ; ne pas supposer que le plafond interne représente le quota Google restant. La remise à zéro Google suit minuit heure du Pacifique.

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

## Phase 3 — filtres validés le 2026-11-03 (limite étendue en phase 4)

Trois paramètres facultatifs : `min_views`, `max_subscribers`, `min_duration_minutes`. Ce sont des entiers positifs ou nuls, écrits en chiffres décimaux ; absence = filtre désactivé, zéro = seuil actif. Les chaînes vides, fractions, signes et notations exponentielles sont refusés (422) avant réservation du quota.

Après les mêmes appels groupés, `filters.py` sélectionne les vidéos avec une logique ET et conserve leur ordre. Vues et durée utilisent un minimum inclusif ; abonnés un maximum inclusif. Le compteur public de `channels.list` est utilisé exclusivement. `hiddenSubscriberCount=true`, compteur absent ou invalide : exclusion si le filtre abonnés est actif. Le compteur public est arrondi vers le bas à trois chiffres significatifs : aucune reconstruction du nombre exact, aucune garantie sur un plafond du nombre réel.

`duration_seconds` centralise la conversion des durées ISO 8601 YouTube contenant jours, heures, minutes et secondes. Elle sert au libellé et au filtrage ; une durée inconnue reste `None`. Les directs en cours et programmés sont exclus lorsque le filtre durée est actif, même pour zéro minute.

La réponse ajoute `examined_count` (vidéos disponibles après enrichissement), `retained_count` (taille de `items`) et `filtered_out_count` (examinées moins retenues). `omitted_count` conserve son sens de vidéos devenues indisponibles. Ces compteurs décrivent le traitement de la requête, sans score ni métrique analytique de chaîne.

Exemple : `/api/videos/search?q=python&min_views=1000&max_subscribers=10000&min_duration_minutes=10`.

Depuis la phase 4, seuls les résultats des deux pages consultées au maximum sont examinés, sans remplacement des exclusions. Aucun résultat ne prouve pas l’absence de vidéos correspondantes ailleurs. Le frontend affiche l’avertissement `notice` et conserve les critères après résultat ou erreur pendant la session de page, sans persistance navigateur. Les filtres n’ajoutent aucun appel ; chaque page supplémentaire demandée manuellement consomme une tentative interne. Aucun package ajouté ni stockage durable des résultats. Shorts reste hors périmètre ; le tri local est décrit dans la phase 5 ci-dessous.

## Phase 4 — pagination manuelle, contrat actuel

Première page : paramètres habituels sans jeton. Deuxième page : mêmes critères avec `page_token` et `page_signature` fournis ensemble. `page_token` est opaque, non vide, limité à 2 048 caractères par politique applicative (pas une limite Google documentée) ; `page_signature` contient 64 caractères hexadécimaux minuscules. Une entrée structurellement invalide donne `422 invalid_parameters` avant réservation.

La réponse ajoute `page_number` (1 ou 2), `next_page_token` et `next_page_signature` (chaîne ou `null`). Les champs `examined_count`, `retained_count`, `filtered_out_count` et `omitted_count` restent propres à cette page. Le frontend additionne les compteurs de pages réussies et déduplique séparément les vidéos affichées, par identifiant et première occurrence. `examined_count` compte les vidéos enrichies, après déduplication des identifiants dans la page ; les indisponibles sont comptées à part.

La signature HMAC-SHA256 lie le jeton aux critères normalisés (mot-clé, dates UTC, filtres) et au contexte « page 2 ». Elle est calculée côté backend avec la clé déjà disponible, sans exposer cette clé ni ajouter de secret de configuration. Une signature incohérente donne `422 invalid_page_token` avant consommation. Un changement de clé invalide les continuations en cours. La signature n’est pas envoyée à Google.

Seule la première page peut délivrer un jeton signé ; après la deuxième, les deux champs de continuation valent toujours `null`, même si Google fournit une troisième page. Un jeton Google répété arrête le parcours, avec notice explicite. Chaque réponse brute est limitée à 50 éléments ; une réponse dépassant cette limite ou contenant un jeton inexploitable produit `502 youtube_invalid_response` sans enrichissement. Aucun jeton ne déclenche un chargement automatique.

Le motif officiel `invalidPageToken` est traduit en `400 invalid_page_token` avec invitation à recommencer depuis la première page. Un échec après réservation reste compté. Les résultats déjà affichés sont conservés après erreur de continuation ; le bouton est bloqué en cas de jeton invalide ou de quota épuisé, et une erreur transitoire autorise une reprise manuelle. Le dernier solde connu peut être périmé après un échec.

Le plafond de deux pages décrit le parcours applicatif, pas un mécanisme anti-rejeu : sans session persistante, une continuation valide peut être redemandée manuellement, avec une nouvelle tentative réservée. Elle ne permet pas de signer un jeton de troisième page. Un utilisateur peut toujours soumettre une nouvelle recherche depuis la première page. Les résultats peuvent évoluer entre appels ; aucun ensemble figé ni exhaustif n’est promis.

Références officielles consultées le 2026-11-04 : [paramètres de recherche et maxResults](https://developers.google.com/youtube/data/reference/rest/v3/search/list), [erreur invalidPageToken](https://developers.google.com/youtube/data/reference/rest/v3/errors). Les quotas Google restent distincts et dépendent des allocations du projet. Aucun appel de recherche YouTube réel n’a été effectué pour ces vérifications documentaires.

## Phase 5 — tri chronologique exclusivement local

Le frontend propose « Pertinence YouTube : ordre initial », « Date décroissante : plus récentes d’abord » et « Date croissante : plus anciennes d’abord ». Le sélecteur agit uniquement sur les vidéos uniques déjà chargées et retenues, sans requête réseau ni consommation de quota. Les paramètres de `search.list`, y compris `order=relevance`, le contrat HTTP et les signatures de continuation restent inchangés. Aucun paramètre de tri n’est transmis au backend.

`sortVideos()` dans `frontend/src/lib/video-sort.ts` retourne une copie et utilise exclusivement `Video.published_at`, issu des données enrichies. La liste source dédupliquée conserve l’ordre de première apparition ; revenir à la pertinence restitue cet ordre, y compris après deux pages. Les compteurs de traitement et le solde quotidien ne sont pas recalculés.

Les dates sont validées au format RFC 3339 avec fuseau explicite, années 0001 à 9999 et calendrier valide. Les instants sont comparés en secondes UTC puis par fraction décimale, sans perte de précision des chiffres fournis. Deux écritures du même instant, y compris avec des décalages horaires ou zéros décimaux différents, sont égales et départagées par l’index source. Dates absentes, vides, sans fuseau, malformées ou impossibles : classement en fin dans les deux directions, ordre source conservé entre elles, sans suppression ni date inventée. Les secondes intercalaires (`:60`) ne sont pas prises en charge et sont traitées comme indisponibles pour ce tri.

Le mode reste en mémoire React pendant la page ouverte, après continuation, erreur et nouvelle recherche. Un rechargement complet revient à la pertinence ; aucun `localStorage` ou `sessionStorage`. La page 2 est fusionnée et dédupliquée comme auparavant, puis l’ensemble est trié selon le mode courant, y compris si celui-ci change pendant la requête.

Ce classement ne découvre aucune vidéo supplémentaire et ne garantit pas le résultat le plus récent ou ancien de YouTube. L’affichage des cartes en jour UTC reste inchangé et peut masquer une différence d’heure ou de fraction prise en compte par le tri. La validation des dates pour le tri est plus stricte que le formateur historique des cartes ; celui-ci n’est pas modifié dans cette phase. Les filtres, dont le correctif temporel backend, restent inchangés.

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
