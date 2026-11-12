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

## Phase 4 — pagination manuelle — 2026-11-04

Branche vérifiée avant modification : `feat/youtube-pagination`. Aucune modification de `main`, aucun commit créé.

Vérifications réellement exécutées :

| Commande / environnement | Résultat |
| --- | --- |
| `python3 -m pytest backend -q`, Python système | Échec au chargement : HTTPX absent |
| `/tmp/youfinder-venv/bin/python -m pytest backend -q` après installation du lockfile existant dans ce venv | **145 tests réussis**, Python 3.11.2 |
| `npm test` depuis `frontend/`, Node 24.22.2 ARM64 | **44 tests réussis dans 4 fichiers** |
| `npm run typecheck` dans `/tmp/youfinder-phase4-frontend` | **Réussi** après correction d’un type de mock Vitest dans les nouveaux tests |
| `npm run build` avec Turbopack dans cette première copie temporaire | Échec : dépendances liées hors de la racine de résolution |
| `npm run build` avec Turbopack dans `.phase4-validation`, copie isolée avec dépendances copiées et liens internes préservés | **Réussi**, compilation, TypeScript et génération statique |
| `git diff --check` | Réussi |

Les dépendances installées viennent du lockfile existant ; aucun manifeste ni lockfile modifié. La copie de build dans le workspace a été utilisée faute d’espace suffisant dans `/tmp` pour y dupliquer les dépendances ; elle est supprimée après vérification. Aucun cache `.next` du frontend en cours n’a été modifié par le build ou le typecheck.

Couverture simulée ajoutée : deux pages de 50, absence de préchargement, limite de 100 identifiants, enrichissements groupés et ordre, doublons intra-page et entre pages, pages entièrement filtrées, dates UTC et filtres conservés, critères instantanés puis réinitialisés, jetons absents/invalides/répétés, signature de continuation, refus d’un jeton associé à d’autres critères ou d’une troisième page, quota épuisé, erreurs réseau/Google, doubles clics, conservation des résultats et reprise manuelle, validation d’une réponse avant fusion. Les tests HTTPX interceptent Google, et les tests Vitest remplacent `fetch` : aucun quota YouTube réel consommé.

Limites des vérifications Codex lors de l’implémentation : pas d’exécution dans les images Compose, Python 3.11.2 au lieu du 3.13.18 des images, pas de recette visuelle navigateur ni d’appel YouTube réel. Les quotas du projet Google ne sont pas inspectés. La consultation des références officielles ne constitue pas un essai de recherche YouTube. Aucun changement OVH, volume Docker ou déploiement.

Recette initialement prévue avant le retour utilisateur consigné ci-dessous : formulaire et consentement, chargement initial puis bouton « Charger 50 vidéos supplémentaires », conservation visuelle pendant chargement/erreur, nombres cumulés et uniques, changement de critères, affichage mobile et accessibilité, suites dans l’environnement Compose habituel. Tout essai connecté YouTube consommerait du quota et nécessite une autorisation distincte.


## Clôture de la phase 4 — recette manuelle rapportée par l’utilisateur

**Statut : phase 4 clôturée sur la base de la validation manuelle déclarée par l’utilisateur.**

Environnement rapporté : application exécutée sous Docker Compose sur Debian 12 ARM64, consultée dans un navigateur macOS. L’utilisateur déclare les **huit scénarios de recette réussis**. Le détail individuel de ces huit scénarios n’est pas fourni dans ce compte rendu ; aucune liste de scénarios supplémentaires ni couverture exhaustive n’est déduite.

Valeurs de la capture telles que rapportées par l’utilisateur (capture non examinée directement pour cette mise à jour) :

| Indicateur | Valeur rapportée |
| --- | --- |
| Pages chargées | 2 sur 2 maximum |
| Vidéos examinées, cumul des pages | 100 |
| Résultats retenus, cumul des pages | 33 |
| Résultats écartés, cumul des pages | 67 |
| Vidéos uniques affichées | 29 |
| Tentatives quotidiennes restantes | 9 sur 20 |

Les compteurs cumulés sont distincts du nombre de vidéos uniques affichées : 33 résultats retenus correspondent ici à 29 vidéos uniques après déduplication. Les 9 tentatives restantes constituent le solde rapporté au moment de la capture ; elles ne permettent pas d’attribuer toute la consommation quotidienne à ce seul parcours.

**Validation automatisée précédemment rapportée par Codex :** 145 tests backend réussis, 44 tests frontend réussis dans 4 fichiers, vérification TypeScript et build Turbopack réussis, dans les environnements et avec les limites déjà consignés. Ces résultats restent historiques et distincts de la recette manuelle ; aucune suite de tests ni aucun build n’a été relancé pour cette clôture documentaire.

La recette navigateur sous Compose complète les vérifications précédentes. Elle n’atteste pas d’une exécution des suites automatisées ou du build dans les conteneurs, ni d’une vérification individuelle de tous les points de la liste de recette initiale (notamment mobile et accessibilité). Les mentions antérieures de recette restante décrivent l’état avant ce retour utilisateur ; la recette des huit scénarios est désormais déclarée réussie. Les limites techniques documentées restent applicables.

Cette mise à jour porte uniquement sur les deux documents de validation et de rapport de phase 4. Aucune nouvelle recherche YouTube, aucun test supplémentaire, aucun commit Git ni déploiement n’a été effectué par Codex pour cette tâche.

## Phase 5 — tri chronologique local — 2026-11-04

Implémentation autorisée sur `feat/youtube-date-sorting`. Tri exclusivement frontend sur les vidéos uniques déjà chargées, avec liste source préservée et aucun changement de pagination ou backend. La modification préexistante de `AGENTS.md` a été laissée intacte.

### Vérifications automatisées réellement exécutées

| Vérification | Résultat réel |
| --- | --- |
| `npm test` depuis `frontend/`, Node 24.22.2 ARM64 | **68 tests réussis dans 5 fichiers**, y compris après les dernières modifications de code et tests |
| `npm run typecheck` dans `.phase5-validation` | **Réussi** : génération des types Next.js et TypeScript |
| `NEXT_TELEMETRY_DISABLED=1 npm run build` dans cette même copie | **Réussi avec Turbopack** : compilation, TypeScript et génération statique |
| `/tmp/youfinder-venv/bin/python -m pytest backend -q` | **145 tests réussis**, Python 3.11.2, code backend inchangé |
| `git diff --check` | Réussi |

Les exécutables Node et Python temporaires et les dépendances existantes ont été réutilisés, sans installation ni ajout de dépendance dans cette phase. Le typecheck et le build ont utilisé une copie isolée du frontend et de `node_modules`, liens internes préservés, dans `.phase5-validation`. Ce dossier temporaire a été retiré après vérification. Le cache `.next` du serveur de développement n’a pas été utilisé ou remplacé par ces commandes.

Couverture ajoutée : 16 tests unitaires de tri et 8 cas d’intégration, plus une assertion d’explication du tri local dans le test existant de l’accueil. Les 44 tests frontend de phase 4 restent inclus dans les 68 tests exécutés. Vérifications : trois modes, stabilité, immutabilité, dates absentes/invalides/impossibles/sans fuseau, décalages UTC, fractions au-delà des millisecondes, calendrier bissextile, listes vides, page 2 fusionnée et dédupliquée, compteurs inchangés, retour à la pertinence, tri modifié pendant une continuation, erreurs/quota, maintien du mode après nouvelle recherche et retour au défaut au remontage. Les tests existants de filtres, dates UTC, consentement, doubles clics et absence d’appel automatique sont conservés.

Les données sont entièrement simulées. Les tests frontend remplacent `fetch` ; les tests backend interceptent Google via les transports existants. Aucun appel YouTube réel ni quota réel consommé.

### Limites et recette manuelle prévue lors de l’implémentation

- Aucune erreur de test, de typecheck ou de build rencontrée dans cette phase. L’exécution hors Compose ne vaut pas validation dans les images Docker ; Python utilisé : 3.11.2 au lieu du 3.13.18 des images.
- Le tri accepte des dates avec fuseau et calendrier valide, années 0001 à 9999, secondes de 00 à 59 ; les secondes intercalaires sont traitées comme dates indisponibles. Les fractions fournies sont conservées sans arrondi.
- Le formateur historique des cartes reste inchangé : l’affichage au jour UTC masque les différences d’heures et fractions, et sa validation est moins stricte que celle du tri.
- La recette manuelle de phase 4 déjà rapportée ne valide pas le nouveau sélecteur. Aucun test visuel navigateur de phase 5 n’a été effectué ou rapporté ici.

Recette phase 5 initialement prévue (avant le retour utilisateur consigné ci-dessous) : vérifier le sélecteur au clavier et sur mobile ; comparer les trois ordres ; constater l’absence d’appel réseau et le solde inchangé au changement de tri ; charger manuellement la deuxième page et revenir à la pertinence ; lancer une nouvelle recherche et vérifier le mode conservé ; recharger complètement et vérifier le retour à la pertinence sans recherche automatique. Les cas de dates invalides et d’erreur de continuation peuvent être vérifiés avec des données simulées. Tout essai YouTube réel reste distinct de cette validation automatisée et nécessite une autorisation.

Aucune modification backend, Docker Compose, dépendance, volume ou secret ; aucune intervention OVH, aucun commit ni déploiement. Rapport et plan conservés dans [[codex-reports/phase-05]].


## Clôture de la phase 5 — recette utilisateur — 2026-11-05

**Statut : recette fonctionnelle de phase 5 clôturée sur la base des 9 scénarios validés manuellement par l’utilisateur.** Ces résultats sont déclarés par l’utilisateur ; ils ne proviennent pas de nouvelles vérifications exécutées par Codex.

| Scénario | Résultat manuel rapporté |
| --- | --- |
| 1. Fonctionnement des trois modes de tri | Validé |
| 2. Retour à « Pertinence YouTube » : restauration de l’ordre initial | Validé |
| 3. Tri chronologique croissant correct | Validé |
| 4. Tri chronologique décroissant correct | Validé |
| 5. Changement de tri sans consommation de tentative YouTube | Validé |
| 6. Conservation du tri après chargement de la deuxième page | Validé |
| 7. Retour à la pertinence après pagination | Validé |
| 8. Conservation du mode choisi lors d’une nouvelle recherche | Validé |
| 9. Réinitialisation du tri après un rechargement complet | Validé |

**Tests automatisés :** les résultats précédemment consignés restent inchangés : 68 tests frontend réussis dans 5 fichiers, 145 tests backend réussis, vérification TypeScript et build Turbopack réussis. Ils sont historiques et distincts de la présente recette utilisateur. Aucune suite de tests ni aucun build n’a été relancé pour cette clôture documentaire.

La validation porte uniquement sur les 9 scénarios ci-dessus. Elle n’atteste pas de vérifications supplémentaires : utilisation au clavier, affichage mobile, absence d’appel réseau, absence de recherche automatique après rechargement, cas de dates invalides ou d’erreur de continuation, ni exécution des suites automatisées dans Compose. Les limites techniques déjà documentées restent applicables.

Les mentions antérieures de recette à effectuer décrivent l’état avant ce retour utilisateur. Cette mise à jour concerne uniquement `docs/validation.md` et `docs/codex-reports/phase-05.md` : aucun code applicatif modifié, aucune nouvelle recherche YouTube ni vérification fonctionnelle exécutée par Codex, aucun commit Git, aucune intervention sur le VPS OVH ni aucun déploiement.

## Phase 6 — dashboard UX/UI — 2026-11-05

Branche : `feat/ui-dashboard`. Plan et décisions dans [le rapport unique de phase 6](codex-reports/phase-06.md). Les validations historiques restent distinctes de cette phase.

### Tests automatisés et build réellement exécutés

| Commande / contexte | Résultat observé |
| --- | --- |
| `npm test` dans `frontend/`, avant modification | **68 tests réussis dans 5 fichiers** |
| `npm test` dans `frontend/`, version finale | **88 tests réussis dans 7 fichiers** |
| `npm run typecheck` dans `.phase6-validation`, code et tests finaux copiés | **Réussi** |
| `NEXT_TELEMETRY_DISABLED=1 npm run build` dans cette copie | **Échec Turbopack** : ouverture de port interdite, en sandbox puis après autorisation hors sandbox |
| `NEXT_TELEMETRY_DISABLED=1 npm run build -- --webpack` dans cette copie, version finale | **Réussi** : compilation, TypeScript, génération de l’accueil et des pages légales |
| `git diff --check` | **Réussi** |

Node 24.22.2 ARM64 réinstallé dans `/tmp`, archive vérifiée avec le SHA-256 officiel. Dépendances existantes du projet conservées. Typecheck et build réalisés dans une copie isolée du frontend, de ses tests et de ses dépendances, liens internes préservés ; aucun cache `.next` du serveur existant remplacé. Cette copie de validation a ensuite été retirée.

Les 68 tests existants restent inclus. Les assertions d’ordre et de nombre de vidéos ciblent désormais les titres h3 des cartes, après ajout des titres h2 de recherche et de résultats ; l’assertion des vues à zéro est limitée aux cartes plutôt qu’aux nouveaux indicateurs. Aucune garantie métier retirée.

20 nouveaux tests : 11 pour le plafond (valeurs nulles/incohérentes, bornes, plafond nul, solde périmé/en attente), 4 pour les compteurs (cumuls/uniques, omissions, pages et répartitions aux limites), 5 pour les interactions (fieldset et aides, unique bouton avant les cartes, annonces séparées, erreur/reprise et jauge, restauration du focus et absence de vol de focus). Les tests existants couvrent toujours filtres, dates UTC, grands entiers, consentement, pagination, déduplication, trois tris, erreurs et absence d’appels automatiques. Réponses entièrement simulées.

### Contrôles automatisés en navigateur réellement exécutés

Playwright **1.65.0** et Chromium Headless Shell **158.0.8127.18** installés uniquement dans `/tmp` pour la vérification, sans ajout aux manifestes/lockfiles du projet. Bibliothèques nécessaires extraites dans `/tmp` depuis des archives Debian vérifiées par SHA-256, sans installation système. Lancement après autorisation hors sandbox.

Le script temporaire `/tmp/youfinder-ui-tools/check-dashboard.cjs` charge le HTML et les assets du build Webpack par interception des requêtes sur un domaine fictif. Toutes les réponses de recherche sont simulées et les requêtes applicatives externes bloquées. Il ne vérifie ni le proxy réel ni Docker Compose. Le dernier passage sur le build final réussit, sans erreur JavaScript de page.

- Accueil avant recherche et après 40 cartes simulées : aucune largeur excédentaire du document à **320, 375, 768 et 1440 px**.
- Absence de requête de recherche supplémentaire au changement de tri ; un seul bouton de continuation avant les cartes.
- Erreur de continuation : jauge masquée, dernier solde connu conservé. Reprise manuelle au clavier puis succès : 98 examinées, 70 retenues, 28 écartées, **55 uniques**, 2 omissions, 2 pages et solde 18/20. Ces chiffres sont des données de test, pas des données YouTube réelles.
- Mode décroissant conservé après continuation ; retour à la pertinence avec première vidéo source restaurée.
- Focus après disparition du bouton sur le résumé de pagination, contour visible ; Tab rejoint le tri.
- Pages `/conditions` et `/confidentialite` : titre principal présent et absence de débordement horizontal à **320 et 1440 px**. Leur contenu n’a pas été modifié.
- Captures du résumé à 375 et 1440 px examinées : groupes, valeurs, barre et textes distincts. Captures temporaires dans `/tmp/youfinder-dashboard-mobile.png` et `/tmp/youfinder-dashboard-desktop.png`.

Contrastes calculés sur les couleurs de rendu échantillonnées (conversion canvas et luminance sRGB) : texte principal/fond **17,06:1**, aide/fond et footer/fond **12,01:1**, texte du champ/fond **13,97:1**, bouton actif blanc/rouge **6,47:1**, contour de focus du champ/fond du champ **8,77:1**. Ce contrôle ciblé n’est pas un audit exhaustif de tous les états et couleurs. Résultat brut temporaire : `/tmp/youfinder-ui-browser-results.json` ; le script n’est pas ajouté à la CI ni aux dépendances du projet.

### Problèmes observés et limites

Deux lancements de `npm test` depuis la racine ont échoué faute de `package.json` ; les exécutions consignées comme réussies ont eu lieu dans `frontend/`. Une première suite après refonte a eu 67 réussites et 1 échec : l’assertion globale de zéro rencontrait aussi un indicateur de traitement. Elle a été précisée pour viser les cartes vidéo. Les suites suivantes ont réussi, dont la version finale à 88 tests.

L’installation réseau de l’outil navigateur et le téléchargement Chromium ont d’abord échoué sur la résolution DNS en sandbox puis réussi après autorisation. Le lancement a révélé des bibliothèques hôte manquantes puis une restriction de sandbox ; préparation isolée des bibliothèques et exécution autorisée nécessaires. Le premier script navigateur avait une attente de rendu trop courte et une assertion de focus trop large ; elles ont été corrigées. Le parcours réel a permis de corriger la restauration du focus lorsque le bouton devient désactivé puis disparaît. Les résultats ci-dessus concernent le dernier passage réussi.

Pas de validation Turbopack dans cet environnement, pas de suite backend relancée pour cette modification frontend. Aucun test dans les conteneurs, proxy réel ou appel YouTube réel. Aucun changement de backend, contrat API, module de tri, filtres métier, manifeste, lockfile ou Compose ; aucun secret affiché, volume supprimé, commit, accès OVH ou déploiement.

### Recette utilisateur restante au bilan initial — non validée à ce stade

Les contrôles navigateur ci-dessus sont automatisés par Codex, pas une recette humaine déclarée réussie. Restent à vérifier : confort d’utilisation et lisibilité sur les appareils/navigateurs habituels (notamment Safari/macOS et mobile réel), parcours clavier complet, lecture effective des annonces avec lecteur d’écran, zoom 200 % et reflow à fort zoom, tous les contrastes/états non échantillonnés, cohérence visuelle des cartes avec miniatures et données réelles déjà disponibles, puis validation utilisateur des parcours de recherche, filtres, tri et pagination. Aucun nouvel appel YouTube n’est nécessaire à une recette avec réponses simulées.


## Phase 6 — complément Turbopack dans Docker Compose, rapporté par l’utilisateur

**Source : exécution manuelle rapportée par l’utilisateur sur sa VM Debian ARM64, dans son environnement Docker Compose.** Codex n’a pas exécuté cette commande ni vérifié directement sa sortie.

Commande exécutée par l’utilisateur :

```bash
sudo docker compose run --rm --no-deps \
  -v /app/.next \
  frontend npm run build
```

Résultat rapporté : **build Next.js 16.4.3 avec Turbopack réussi**. Compilation de production en **1962 ms**, vérification TypeScript, collecte des données des pages, génération des **5 pages statiques** et optimisation finale réussies ; retour au terminal sans erreur visible.

Ce résultat complète les vérifications Codex sans les remplacer : dans l’environnement Codex, Turbopack avait échoué sur l’ouverture d’un port local interdit, en sandbox puis après autorisation ; le build Webpack avait réussi. Cet échec historique est conservé. Le build Turbopack est désormais déclaré réussi dans l’environnement Docker Compose de l’utilisateur, distinct de l’environnement Codex.

Cette validation porte sur le build frontend uniquement. Elle n’atteste ni d’une nouvelle exécution des suites de tests dans Docker, ni du fonctionnement du proxy ou du backend, ni d’une recette UX/accessibilité complète, ni d’une validation complète de l’application en production. La recette utilisateur fonctionnelle et les contrôles manuels restants de phase 6 ne sont pas clôturés par ce seul build.

Pour cette mise à jour documentaire, Codex n’a relancé aucun test, build ou recherche YouTube, modifié aucun code applicatif, créé aucun commit Git, ni effectué de déploiement ou d’intervention OVH. Les modifications préexistantes du workspace sont préservées.


## Clôture documentaire de la phase 6 — 2026-11-12

**Statut : phase 6 acceptée pour clôture par l’utilisateur, avec les réserves ci-dessous.** La recette principale du dashboard UX/UI est terminée. Le plan initial, le bilan et les résultats précédents sont conservés comme historique ; leurs mentions de recette restante décrivent l’état avant cette clôture.

### Validations techniques déjà confirmées par l’utilisateur

| Vérification automatisée | Résultat confirmé | Environnement |
| --- | --- | --- |
| Tests frontend | **88 tests réussis** | Docker Compose |
| Typecheck | **Réussi** | Docker Compose |
| Build Next.js 16.4.3 avec Turbopack | **Réussi** | Conteneur temporaire Docker Compose |

Ces confirmations complètent les résultats historiques, dont le complément Turbopack ci-dessus. Elles sont rapportées par l’utilisateur, sans nouvelle exécution ni vérification directe des sorties par Codex lors de cette clôture. Elles ne valent pas validation exhaustive de l’accessibilité ou de la production.

### Recette principale — observations confirmées par l’utilisateur

- Les cinq indicateurs affichent des valeurs cohérentes ; vidéos retenues et vidéos uniques sont correctement distinguées.
- La barre retenues/écartées et la jauge du quota interne sont cohérentes.
- Les dates et les filtres avancés fonctionnent.
- Le bouton de pagination est visible avant les cartes ; la pagination est limitée à deux pages.
- Les trois modes de tri fonctionnent et les cartes vidéo sont lisibles.
- Le zoom navigateur à 200 % fonctionne.
- Les pages Confidentialité et Conditions sont lisibles.
- Aucune anomalie métier n’est signalée dans cette recette.

Ces observations utilisateur sont distinctes des tests automatisés. Elles ne confirment pas les contrôles détaillés ci-dessous.

### Réserves et contrôles restant à effectuer

| Contrôle | État à la clôture |
| --- | --- |
| Responsive sur appareil mobile réel | **Non testé, non validé.** Les contrôles antérieurs sur des largeurs simulées ne remplacent pas ce contrôle. |
| Navigation clavier générale | Fonctionnement rapporté comme utilisable ; cette observation ne valide pas le parcours détaillé. |
| Recette clavier détaillée | **Restant à effectuer** : Tab, Maj+Tab, Entrée, Espace, visibilité et déplacement du focus, notamment lors de la disparition du bouton de pagination. Les tests antérieurs ne remplacent pas cette confirmation utilisateur. |

Les contrôles antérieurement prévus mais non confirmés restent non validés, notamment l’écoute avec lecteur d’écran, le reflow à fort zoom et les contrastes/états non échantillonnés. Le zoom à 200 % confirmé ne vaut pas validation de tous ces contrôles.

### Navigation vers les pages légales — comportement constaté et suite envisagée

L’utilisateur observe que les résultats disparaissent lors du retour à l’accueil après consultation des pages légales. Ce comportement est consigné comme une limitation observée ; son origine et sa date d’introduction ne sont pas établies. Aucune preuve ne permet de l’attribuer à la phase 6 ou de le qualifier de régression confirmée.

Prévoir dans une phase future une étude de conservation de l’état de recherche lors de cette navigation. Aucune correction n’est implémentée dans cette clôture. Les réserves ci-dessus ne sont pas présentées comme des régressions confirmées et n’empêchent pas la clôture acceptée par l’utilisateur.

### Périmètre de cette clôture documentaire

Seuls `docs/validation.md` et `docs/codex-reports/phase-06.md` sont mis à jour. Aucun test automatisé, build ou recherche YouTube n’est relancé pour cette tâche ; le contrôle documentaire `git diff --check` a réussi. Aucun code applicatif modifié, commit Git créé, déploiement effectué ou intervention OVH réalisée. Les modifications préexistantes du workspace sont préservées.
