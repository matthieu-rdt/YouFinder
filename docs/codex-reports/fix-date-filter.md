# Correction du filtrage des dates — YouFinder

Date : 2026-11-03. Périmètre : diagnostic et correction autorisés du filtrage temporel, sans déploiement.

## Objectif et symptôme

Pour la période du **01/06/2026 au 07/07/2026 inclus**, avec vues minimum **10000**, durée minimum **3 minutes** et abonnés maximum vide, une vidéo affichée comme publiée le **03/11/2026** a été signalée parmi cinq vidéos retenues sur dix examinées.

Garantir que toute vidéo retenue respecte les bornes demandées sur sa date de publication enrichie, sans appel YouTube supplémentaire.

## Diagnostic et cause démontrée

Les numéros « avant correction » se réfèrent au code inspecté au début de cette tâche.

| Étape inspectée | Fichier et lignes | Constat avant correction |
| --- | --- | --- |
| Formulaire et validation | `frontend/src/components/video-search.tsx`, lignes 18–29 | Lecture de jours ISO par les champs HTML ; contrôle de l’ordre ; début sérialisé à 00:00 UTC et fin à 23:59:59.999 UTC. Aucun mélange jour/mois dans ce trajet. |
| Sérialisation HTTP | Même fichier, lignes 27–41 | `URLSearchParams` transporte `published_after` et `published_before` ; appel explicite sans cache. |
| Validation FastAPI | `backend/app/schemas.py`, lignes 28–50 | Validation RFC 3339, présence du fuseau et ordre des bornes ; absence de validation temporelle des vidéos à ce niveau. |
| Route et compteurs | `backend/app/routes/videos.py`, lignes 36–42 | Réservation d’une seule tentative, enrichissement, puis appel à `filter_videos` ; compteurs calculés sur les listes avant/après filtres. |
| Transmission à Google | `backend/app/youtube.py`, lignes 127–133 | Traduction correcte vers `publishedAfter` et `publishedBefore`, avec conversion en UTC, dans `search.list`. |
| Dates de recherche | Même fichier, lignes 55–60 | Le modèle des résultats de recherche ne conserve que les identifiants ; aucune comparaison des dates des deux ressources. |
| Date enrichie utilisée | Même fichier, lignes 138–160 | `published_at` vient de `videos.list.snippet.publishedAt`, puis est affiché par `frontend/src/components/video-card.tsx`, ligne 16. |
| Filtrage final | `backend/app/filters.py`, lignes 6–20 | Contrôles vues, abonnés et durée uniquement : **aucun contrôle de `published_at` sur les vidéos enrichies**. |

**Cause locale établie :** l’application se reposait entièrement sur le filtrage temporel de `search.list`, tout en affichant la date issue de `videos.list`. Si l’enrichissement fournit une date hors période, la vidéo passe dès lors qu’elle satisfait les autres critères. Une reproduction avec une vidéo simulée du 03/11/2026, 10000 vues et trois minutes a échoué avant correction : elle était retenue. La même reproduction passe après correction : elle est exclue.

La borne à 23:59:59.999 UTC présentait aussi un défaut de précision pour les fractions de seconde suivantes de la journée. Ce défaut pouvait exclure une vidéo en fin de journée ; il n’explique pas l’admission d’une vidéo plusieurs mois après la période.

### Ce qui n’est pas établi

Les échanges HTTP de la recherche initialement observée et l’identifiant réel de la vidéo n’ont pas été fournis. La raison exacte de la présence de cet identifiant dans cette réponse de recherche réelle n’est donc pas démontrée. Aucun appel Google réel n’a été effectué pour tenter de la reproduire. Il n’existe ici aucune preuve permettant d’attribuer cette anomalie à Google.

La documentation décrit les bornes `search.list` en termes de création des ressources et `videos.list.snippet.publishedAt` comme une date de publication pouvant différer du téléversement. Cela justifie de ne pas supposer l’égalité des deux dates ; cela ne prouve pas que cette différence explique le cas observé. La date enrichie reste la référence utilisée pour la sélection et l’affichage, sans substitution par celle de recherche.

Sources officielles consultées : [paramètres de recherche](https://developers.google.com/youtube/data/reference/rest/v3/search/list) et [date de publication des vidéos](https://developers.google.com/youtube/data/reference/rest/v3/videos).

## Corrections et décisions techniques

- Ajout de `parse_rfc3339_utc` dans `backend/app/dates.py`, ligne 6 : lecture stricte d’un instant avec fuseau, validation calendaire et normalisation en `datetime` timezone-aware UTC. Réutilisation pour les bornes et les dates enrichies.
- Normalisation UTC des bornes dans `backend/app/schemas.py`, lignes 30 et 40. Rejet d’un intervalle vide ou inversé avant réservation du quota. OpenAPI décrit explicitement début inclus et fin exclusive.
- Ajout du contrôle dans `backend/app/filters.py`, ligne 8, après enrichissement : `published_after <= published_at < published_before`, avec chaque borne facultative. Dates manquantes, invalides ou sans fuseau exclues lorsqu’au moins une borne est demandée. Sans borne temporelle, le comportement antérieur est conservé.
- Ajout de `nextUtcDayStart` dans `frontend/src/lib/youtube.ts`, ligne 41, et utilisation dans `frontend/src/components/video-search.tsx`, ligne 29. Calcul du lendemain avec `setUTCDate`, sans dépendance au fuseau local ni aux changements d’heure. Conservation des jours sélectionnés dans le formulaire.
- Pour la période signalée : début `2026-06-01T00:00:00Z`, fin exclusive `2026-07-08T00:00:00Z`. Le 07/07 à 23:59:59.999999 UTC est inclus ; le 08/07 à 00:00:00 UTC et le 03/11 sont exclus.
- Les bornes restent transmises à `search.list`. Google documente `publishedBefore` comme « avant ou à » la borne : le contrôle final impose notre exclusion stricte de cet instant.
- Ordre de pertinence conservé. `examined_count` compte toujours les vidéos disponibles après enrichissement ; `filtered_out_count` inclut les exclusions temporelles ; `retained_count` correspond à la taille de `items` ; `omitted_count` reste réservé aux vidéos indisponibles.
- Les noms des paramètres HTTP ne changent pas. Leur convention de fin est désormais explicitement exclusive ; les clients API doivent fournir un instant exclusif, sans ajout automatique d’un jour côté backend.

## Fichiers créés ou modifiés

Créés :

- `backend/app/dates.py`
- `frontend/tests/dates.test.ts`
- `docs/codex-reports/fix-date-filter.md`

Modifiés :

- `backend/app/filters.py`
- `backend/app/schemas.py`
- `backend/tests/test_filters.py`
- `backend/tests/test_search.py`
- `backend/tests/test_youtube.py`
- `frontend/src/components/video-search.tsx`
- `frontend/src/lib/youtube.ts`
- `frontend/tests/search.test.tsx`
- `README.md`
- `docs/youtube-api.md`
- `docs/incidents.md`
- `docs/validation.md`

Le client YouTube et la route conservent leurs appels et leur calcul de compteurs existants. Aucun package ou lockfile modifié.

## Tests réellement exécutés et résultats

Environnement : Debian ARM64, Python **3.11.2** dans l’environnement temporaire existant, Node **24.22.2 ARM64**, Next.js **16.4.3**. Réponses YouTube simulées, aucun quota Google réellement consommé.

| Commande ou vérification | Résultat |
| --- | --- |
| Reproduction simulée avant correction | Échec attendu de l’assertion : la vidéo de novembre était retenue |
| Même reproduction après correction | Réussie : la vidéo de novembre est exclue |
| `/tmp/youfinder-venv/bin/python -m pytest backend -q` | **116 tests réussis** |
| `npm test` depuis `frontend/` avec Node 24.22.2 dans le PATH | **27 tests réussis dans 4 fichiers** |
| `npm run typecheck` dans une copie isolée du frontend | **Réussi** |
| `npm run build` dans cette copie, télémétrie désactivée | **Réussi avec Turbopack**, TypeScript et génération des pages inclus |
| `git diff --check` | Réussi, aucune erreur d’espacement |

Le build a été effectué dans une copie temporaire sous le workspace, avec une copie locale des dépendances, pour préserver le cache `.next` du serveur existant. Un premier essai de typecheck de cette copie a échoué car la copie avait déréférencé les liens des exécutables dans `node_modules/.bin`. Après restauration de ces liens dans la seule copie temporaire, typecheck et build par défaut ont réussi. Aucun changement de configuration du projet n’a été nécessaire.

### Couverture de régression

- Avant, dans et après la période du 01/06/2026 au 07/07/2026 inclus, dont le 03/11/2026.
- Premier jour à 00:00:00 UTC ; dernier jour à 23:59:59 et à 23:59:59.999999 UTC ; lendemain à 00:00:00 UTC.
- Dates absentes, invalides, calendaires impossibles ou sans fuseau ; bornes unilatérales et absence de filtre temporel.
- Dates avec décalage horaire normalisées en UTC, y compris aux frontières de l’intervalle.
- Combinaison avec minimum 10000 vues et trois minutes ; rejet indépendant d’un compteur insuffisant ou d’une durée trop courte.
- Paramètres effectivement reçus par le transport simulé Google : `publishedAfter=2026-06-01T00:00:00Z`, `publishedBefore=2026-07-08T00:00:00Z`, dix résultats, pertinence et aucune pagination.
- Réponses simulées dont les dates de recherche et d’enrichissement diffèrent ; ordre d’enrichissement inversé pour vérifier la pertinence finale.
- Compteurs avec et sans vidéo indisponible : 10 examinées, 3 retenues, 7 écartées, 0 omise ; ou 9 examinées, 3 retenues, 6 écartées, 1 omise. Ces chiffres appartiennent aux fixtures de test, pas à la recherche réelle signalée.
- Trois appels groupés au total et une seule réservation du compteur interne ; aucune requête supplémentaire pour valider les dates.
- Frontend : période signalée, recherche sur un seul jour, abonnés maximum vide, changements de mois/année, année bissextile et jours de changement d’heure.

## Limites, validation restante et prochaines étapes

- La recherche réelle signalée n’a pas été rejouée et sa réponse initiale n’est pas disponible. Le défaut local est reproduit et corrigé ; l’origine du résultat initial reste non prouvée.
- Les tests sont exécutés hors Docker, sous Python 3.11.2 plutôt que Python 3.13.18 de l’image. Aucun nouveau test Compose ni essai visuel dans un navigateur effectué pendant cette correction.
- Les résultats restent limités aux dix premiers identifiants par pertinence, sans remplacement après exclusion.
- Recette recommandée dans le navigateur : refaire la période du 01/06/2026 au 07/07/2026 inclus avec les filtres signalés, puis vérifier les dates visibles et les compteurs. Une nouvelle recherche réelle consommera la tentative et le quota habituels.
- Vérifier ensuite les suites dans l’environnement Compose local autorisé, sans supprimer de volume. Toute mise en production nécessite une validation distincte.

Aucun volume Docker, service OVH, quota, secret ou dépendance n’a été modifié. Aucun déploiement effectué.
