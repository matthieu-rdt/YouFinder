# Phase 04 — Pagination YouTube

Phase 4 clôturée après recette manuelle déclarée réussie par l’utilisateur (huit scénarios). Implémentation réalisée après validation des ajustements utilisateur. Le plan initial ci-dessous est conservé comme historique. Le rapport d’implémentation et les résultats réels figurent à la fin du document.

## Plan initial conservé — avant validation

Date : 2026-11-04. Projet : YouFinder.

**Statut : proposition à examiner et à valider avant développement. Aucune fonctionnalité de pagination n’est implémentée par ce document.**

Provenance : le plan précédemment évoqué n’est pas disponible dans le contexte de rédaction ni retrouvé dans le dépôt. Ce document est une proposition reconstruite à partir du code et de la documentation existants ; sa fidélité au plan précédent reste à confirmer. Les choix ci-dessous sont soumis à validation.

## Objectif et périmètre

**Proposé :** permettre de consulter manuellement les pages suivantes d’une même recherche YouTube, en conservant le mot-clé, les dates et les filtres validés. Chaque action explicite charge au maximum dix résultats bruts supplémentaires, enrichis et filtrés selon les règles existantes.

Périmètre proposé : bouton « Charger la page suivante », ajout des vidéos à la liste en mémoire, compteurs de traitement par page et cumulés, prise en charge de `nextPageToken`, conservation des résultats en cas d’échec d’une page suivante.

Hors périmètre : parcours automatique, défilement infini, taille de page configurable, navigation numérotée ou retour via `prevPageToken`, stockage des recherches, PostgreSQL, nouveau tri, filtres Shorts, métriques analytiques, téléchargement audiovisuel et déploiement. Aucune dépendance supplémentaire prévue.

## État actuel de l’application

**Existant, constaté dans le code :**

- `GET /api/videos/search` valide `q`, les bornes de publication et les trois filtres facultatifs : `min_views`, `max_subscribers`, `min_duration_minutes`. Les paramètres inconnus sont refusés.
- Le routeur réserve une tentative quotidienne avant l’appel Google ; le compteur local durable est partagé par l’installation.
- Le client effectue un `search.list` avec `maxResults=10`, `type=video` et `order=relevance`, puis les enrichissements groupés `videos.list` et `channels.list` lorsque nécessaires.
- Les filtres sont appliqués après enrichissement, en préservant l’ordre. Les dates sont contrôlées sur la publication enrichie, avec fin exclusive.
- La réponse expose `items`, `omitted_count`, `examined_count`, `retained_count`, `filtered_out_count`, `daily_limit`, `searches_remaining` et `notice`.
- Le frontend déclenche une recherche à la soumission explicite, sans cache de réponse ni appel au montage. Il conserve les champs après réponse ou erreur, mais efface les résultats au début d’une nouvelle soumission.
- Aucun paramètre `page_token`, jeton de réponse ou bouton de pagination n’existe dans le contrat applicatif actuel.

Références locales : `backend/app/schemas.py`, `backend/app/routes/videos.py`, `backend/app/youtube.py`, `backend/app/quota.py`, `frontend/src/components/video-search.tsx`, `frontend/src/lib/youtube.ts`, `docs/youtube-api.md`.

## Architecture proposée

**Modifications proposées :** prolonger le flux existant navigateur → proxy Next.js → FastAPI → API officielle YouTube, sans session backend ni cache de résultats.

1. Le frontend mémoriserait un instantané des critères effectivement soumis, distinct des champs en cours d’édition.
2. Le backend accepterait un jeton facultatif et le transmettrait comme `pageToken` à `search.list`, avec les paramètres de recherche inchangés.
3. Le client retournerait les vidéos enrichies, le nombre de vidéos omises et le jeton de continuation de la page brute. La structure interne exacte serait définie lors de l’implémentation.
4. Le routeur appliquerait les filtres existants à cette seule page et ajouterait le jeton au contrat public.
5. Le frontend ajouterait les résultats de la page réussie à la liste en mémoire.

Une requête applicative traiterait exactement une page brute. Aucune boucle ne chercherait automatiquement à obtenir dix vidéos retenues. La clé API resterait exclusivement côté backend.

## Contrat API backend

**Existant conservé :** route, paramètres de recherche, filtres, forme des vidéos et champs de réponse actuels.

**Ajouts proposés :**

| Élément | Proposition | Sémantique |
| --- | --- | --- |
| Requête `page_token` | Chaîne facultative, non vide, longueur maximale proposée de 2 048 caractères | Absence : première page ; présence : continuation transmise à YouTube |
| Réponse `next_page_token` | Chaîne ou `null`, toujours présente | Jeton de la page suivante, ou absence de continuation |

La limite de longueur serait une protection applicative à vérifier avec la documentation officielle avant implémentation, sans inventer de format Google. Un jeton fourni vide ou trop long serait rejeté en 422 avant réservation du quota. Il ne serait ni décodé ni modifié ; son encodage de transport passerait par les outils de paramètres HTTP.

Exemples de forme, avec valeur de jeton uniquement illustrative :

```text
GET /api/videos/search?q=python&min_views=1000
GET /api/videos/search?q=python&min_views=1000&page_token=JETON_OPAQUE
```

Les compteurs backend continueraient de décrire **la page de cette réponse**, jamais un cumul fourni par le navigateur : `retained_count = len(items)` et `examined_count = retained_count + filtered_out_count`. `omitted_count` garderait son sens actuel.

`daily_limit` et `searches_remaining` resteraient des informations du plafond interne global. Aucun total de résultats ni nombre total de pages ne serait promis. Le texte `notice` serait adapté pour décrire les pages effectivement consultées et la non-exhaustivité.

## Gestion de nextPageToken

**Proposé :** récupérer le champ officiel `nextPageToken` de `search.list` et l’exposer sous le nom `next_page_token`. Son absence serait représentée par `null`. Sa structure et son type seraient validés ; une valeur inexploitable déclencherait une erreur de réponse Google invalide.

Le jeton serait opaque et conservé uniquement dans l’état mémoire du frontend. Une page dont toutes les vidéos sont filtrées pourrait tout de même avoir une suite : le bouton dépendrait du jeton, pas du nombre de vidéos retenues.

Une nouvelle soumission repartirait de la première page et réinitialiserait liste, jeton, compteurs et suivi des pages traitées. La pagination utiliserait l’instantané des critères soumis, même si les champs sont ensuite édités ; l’interface préciserait que les modifications s’appliquent à une nouvelle recherche.

Les vidéos seraient dédupliquées par identifiant dans la liste affichée, en conservant la première occurrence et l’ordre d’arrivée. Les compteurs cumulés resteraient des sommes de traitements de pages ; ils pourraient différer du nombre de vidéos uniques affichées. Un jeton identique au jeton demandé ou déjà consommé arrêterait la continuation avec un message explicite, pour éviter une boucle manuelle improductive.

Le backend resterait sans état de pagination : il ne garantirait pas qu’un jeton provient des critères fournis. Le frontend assurerait leur cohérence dans le parcours normal. La validité ou l’expiration d’un jeton resterait du ressort de YouTube.

## Gestion des quotas

**Existant conservé :** plafond interne configurable, vingt tentatives quotidiennes par défaut, journée Europe/Paris, réservation durable avant Google, tentative échouée comptée, entrées invalides ou clé absente non comptées. Les quotas Google sont indépendants.

**Proposé :** chaque première page et chaque page suivante consommeraient une tentative interne distincte. Une page sans vidéo retenue consommerait aussi cette tentative. Aucun chargement anticipé, retry automatique, remplacement de vidéo filtrée ou enrichissement par vidéo ne serait ajouté.

Chaque page entraînerait un appel de recherche et au plus les deux enrichissements groupés existants. Avant développement, vérifier les coûts et allocations dans les sources officielles ; ne pas assimiler le compteur local au quota Google disponible. Aucun tarif ou coût Google nouveau n’est affirmé ici.

Le frontend afficherait la dernière valeur connue de `searches_remaining` et empêcherait une continuation lorsque celle-ci vaut zéro. Le backend resterait l’autorité, notamment en cas d’usage concurrent. Après une erreur, la valeur affichée pourrait être périmée : l’interface ne devrait pas affirmer qu’aucune tentative n’a été consommée.

## Comportement du frontend

**Existant conservé :** soumission explicite, consentement, cartes YouTube, critères facultatifs, messages de limites et absence d’appel au montage ou au rafraîchissement.

**Proposé :**

- Présenter les résultats cumulés et un bouton de continuation uniquement lorsqu’un jeton utilisable est disponible.
- Distinguer chargement initial et chargement de page suivante ; désactiver les actions concurrentes, avec verrou synchrone contre les doubles clics.
- Associer chaque réponse à la recherche active et ignorer les réponses devenues obsolètes. Une éventuelle annulation navigateur ne garantirait pas l’annulation des appels backend ni du quota consommé.
- Ajouter une page seulement après son succès complet ; conserver les résultats existants pendant le chargement et en cas d’erreur de continuation.
- Présenter clairement le nombre de pages chargées, les compteurs de traitement et le nombre de vidéos uniques affichées.
- Autoriser une continuation après une page entièrement filtrée ; afficher la fin de parcours lorsque le jeton manque, même si moins de dix vidéos ont été reçues.
- Annoncer chargements, erreurs et ajouts via les mécanismes accessibles existants, sans déplacement de focus inattendu.

Aucune persistance navigateur, aucun parcours en arrière et aucun appel déclenché par la seule modification des champs ne seraient ajoutés.

## Gestion des erreurs

**Existant conservé :** enveloppe `{"error":{"code":"...","message":"..."}}`, messages publics maîtrisés, aucune clé, URL Google ou réponse brute Google exposée. Les erreurs de quota, réseau, délai et enrichissement resteraient explicites ; aucun résultat partiel ne serait présenté comme une page réussie.

**Proposé :**

- Rejeter localement un jeton structurellement invalide avec `422 invalid_parameters`, sans consommation interne.
- Étudier le motif officiel d’erreur pour un jeton refusé par Google et définir un code public dédié, par exemple `invalid_page_token`, seulement si ce motif permet une identification fiable. Sinon, conserver l’erreur générique existante sans prétendre connaître la cause.
- Pour un jeton refusé, proposer de relancer explicitement la recherche depuis la première page, sans relance automatique.
- Pour une erreur transitoire de continuation, conserver le jeton et permettre une nouvelle tentative manuelle en indiquant qu’elle peut consommer une nouvelle tentative interne.
- Ne modifier liste, compteurs cumulés et jeton qu’après une réponse entièrement validée ; bloquer une continuation cyclique.

## Tests prévus

**À écrire ou adapter après validation ; aucun de ces tests n’a été exécuté pour ce plan.** Toutes les réponses YouTube seraient simulées via les mécanismes existants.

Backend :

- Première page sans `pageToken`, page suivante avec transmission exacte du jeton et conservation des autres paramètres.
- Validation du jeton avant réservation ; refus des paramètres inconnus maintenu.
- Extraction du jeton, absence de suite, structure invalide, page brute vide et page entièrement filtrée avec continuation.
- Enrichissement groupé, ordre, omissions, dates et filtres inchangés ; au plus trois appels Google simulés par page.
- Une réservation par page, y compris résultat filtré vide ou échec après réservation ; aucune réservation pour une entrée invalide ou une clé absente.
- Erreurs de jeton, quota, réseau et enrichissement, sans exposition de secrets ni réponse partielle trompeuse.

Frontend :

- Ajout de pages, paramètres issus de l’instantané, jeton correctement encodé et réinitialisation lors d’une nouvelle recherche.
- Pages entièrement filtrées, fin sans jeton, doublons vidéo et jetons répétés.
- Compteurs cumulés distincts du nombre de vidéos uniques ; quota nul et quota épuisé entre deux actions.
- Double clic, réponse obsolète, conservation de la liste après erreur et nouvelle tentative uniquement manuelle.
- Aucun appel au montage, à l’édition des champs ou au rafraîchissement ; messages accessibles.

Vérifications prévues : pytest backend, tests frontend, TypeScript et build selon l’environnement disponible. Les résultats réels et limites d’environnement seraient consignés après implémentation, sans reprendre les succès de phase 3 comme preuve pour cette phase.

## Fichiers concernés

**Seul fichier créé pour cette demande :** `docs/codex-reports/phase-04-plan.md`.

**Fichiers envisagés pour une future implémentation, non modifiés ici :**

| Fichier | Modification proposée |
| --- | --- |
| `backend/app/schemas.py` | Paramètre et champ de réponse pour les jetons, validation et notice |
| `backend/app/youtube.py` | Transmission et extraction du jeton ; adaptation du retour interne |
| `backend/app/routes/videos.py` | Propagation du jeton, compteurs par page, réservation existante |
| `backend/tests/test_search.py` | Contrat HTTP et validation avant quota |
| `backend/tests/test_youtube.py` | Pagination simulée, appels groupés et erreurs |
| `frontend/src/lib/youtube.ts` | Extension du contrat TypeScript |
| `frontend/src/components/video-search.tsx` | État de recherche, continuation, ajout, erreurs et compteurs |
| `frontend/tests/search.test.tsx` | Parcours et concurrence de pagination |
| `README.md`, `docs/youtube-api.md` | Fonctionnement et limites actualisés après implémentation |
| `docs/architecture.md`, `docs/validation.md` | Décisions ouvrables dans Obsidian et vérifications réellement réalisées |

`backend/app/quota.py` serait réutilisé sans changement de politique ; ses tests existants seraient conservés. Aucun changement prévu aux services, images, dépendances, volumes ou secrets.

## Risques et limites

- L’absence du plan original empêche de garantir une reprise fidèle ; les choix de ce document doivent être examinés comme propositions.
- Les résultats et jetons peuvent évoluer entre deux appels ; doublons, disparitions et variations d’ordre restent possibles.
- Une pagination plus profonde consomme davantage de tentatives et de quota, sans garantir de nouvelles vidéos retenues.
- Les filtres portent sur les pages consultées, avec les limites existantes sur les abonnés publics arrondis et les données indisponibles. Aucune exhaustivité n’est garantie.
- Les cumuls comptent des traitements, pas nécessairement des vidéos distinctes ; leur présentation doit éviter toute ambiguïté.
- Les requêtes GET peuvent figurer dans les journaux techniques existants. Ne pas ajouter de journalisation applicative des jetons ou des résultats.
- La liste grandit en mémoire jusqu’à une nouvelle recherche ou au rechargement ; aucun stockage durable n’est prévu.
- Le plafond local reste adapté à l’installation actuelle, sans garantie distribuée. La validité des jetons et le mapping des erreurs nécessitent une vérification officielle avant codage.

## Étapes d’implémentation

1. **Attendre la validation de ce plan**, notamment du parcours par ajout, du contrat de jetons et de la présentation des cumuls.
2. Vérifier la documentation officielle sur `pageToken`, `nextPageToken`, les erreurs et les quotas, sans effectuer de recherche YouTube réelle.
3. Étendre le contrat backend et ses tests de validation.
4. Adapter le client et le routeur pour une page à la fois ; tester avec transports simulés et plafond existant.
5. Adapter le frontend, puis tester continuation, réinitialisation, doublons, concurrence et erreurs.
6. Exécuter les vérifications disponibles et documenter leurs résultats réels et limites.
7. Actualiser les documents techniques et présenter les changements pour recette. Tout essai YouTube réel et tout déploiement demanderaient une autorisation distincte.

La présente intervention est documentaire uniquement : aucune implémentation, recherche YouTube réelle, création de commit, modification de service ou opération OVH.

---

# Rapport d’implémentation de phase 04 — 2026-11-04

## Ajustements validés après le plan initial

L’utilisateur a autorisé l’implémentation sur `feat/youtube-pagination` avec **50 résultats bruts maximum par page**, **deux pages maximum**, soit **100 identifiants maximum par parcours**, et un unique bouton manuel « Charger 50 vidéos supplémentaires ». Ces décisions remplacent la taille de dix résultats et la continuation non bornée envisagées dans le plan historique ci-dessus. La convention de fichier est `docs/codex-reports/phase-XX.md` ; aucun fichier `phase-04-plan.md` n’a été recréé.

Le plan est conservé pour traçabilité ; les sections « proposé », « existant » et « tests prévus » précédentes décrivent l’état au moment de sa rédaction. Le présent rapport décrit les changements réellement réalisés, sans constituer une validation de recette utilisateur.

## Modifications réellement effectuées

- Branche active vérifiée avant toute modification : `feat/youtube-pagination`. Le fichier de plan `phase-04.md` était déjà présent et non suivi ; son contenu a été conservé.
- `search.list` demande `maxResults=50`. Chaque requête applicative traite une seule page, puis les enrichissements groupés et les filtres existants. Les réponses brutes dépassant 50 éléments sont rejetées. Aucun remplissage des exclusions ni parcours automatique.
- Contrat étendu : requête `page_token` avec `page_signature`, réponse `page_number`, `next_page_token` et `next_page_signature`. Les jetons restent opaques ; la limite applicative de 2 048 caractères n’est pas présentée comme une limite officielle Google.
- Une signature HMAC-SHA256 lie le jeton de deuxième page aux critères normalisés. Elle utilise la clé déjà disponible exclusivement côté backend, sans l’exposer ni ajouter de secret de configuration. Le frontend transmet la signature au backend uniquement. Les jetons ou critères modifiés sont refusés avant réservation du quota.
- Seule la première page délivre une continuation signée. Après la deuxième, les champs de continuation sont nuls, même si YouTube fournit un jeton supplémentaire ou répété. Un jeton répété est signalé dans la notice. Le motif Google `invalidPageToken` devient une erreur publique contrôlée invitant à recommencer la recherche.
- Le frontend mémorise les critères soumis. Les champs édités ne modifient pas la continuation ; une nouvelle soumission valide réinitialise résultats, compteurs et jetons. Le verrou immédiat empêche les doubles clics et les soumissions concurrentes.
- Les pages réussies sont ajoutées dans l’ordre. Les vidéos affichées sont dédupliquées par identifiant, avec conservation de la première occurrence. Les cumuls des vidéos examinées, retenues, écartées et indisponibles sont distincts du nombre de vidéos uniques affichées. Le nombre de pages et les tentatives quotidiennes restantes sont visibles.
- Une page entièrement filtrée peut autoriser la deuxième page. Aucune troisième page ne peut être demandée par le parcours frontend ni autorisée par un nouveau jeton signé du backend.
- Chaque page réserve une tentative du plafond existant. Aucun retry automatique. Une erreur de continuation préserve les résultats, compteurs et jeton précédents ; quota épuisé ou jeton invalide bloque la continuation. Une erreur transitoire laisse une reprise manuelle possible. Le message indique que le solde peut être périmé après erreur.
- Validation de la réponse complète avant fusion, actualisation des limites sur l’accueil et les conditions d’utilisation. Aucun changement de filtre métier, de correctif temporel, de dépendance, de service ou d’image.

## Fichiers créés et modifiés

| Fichier | Intervention réelle |
| --- | --- |
| `backend/tests/test_pagination.py` | Créé : tests HTTPX simulés de pagination, signatures, limites et erreurs |
| `backend/app/schemas.py` | Paramètres et réponse de pagination, validation, notice |
| `backend/app/youtube.py` | Pages de 50, extraction/transmission du jeton, validation, erreur officielle |
| `backend/app/routes/videos.py` | Signature des critères, vérification avant quota, arrêt après page 2 |
| `backend/tests/test_search.py` | Adaptation à 50 résultats et nom du test d’absence de chargement automatique |
| `backend/tests/test_youtube.py` | Attente de `maxResults=50` dans la régression temporelle |
| `frontend/src/lib/youtube.ts` | Contrat typé et validation des réponses avant fusion |
| `frontend/src/components/video-search.tsx` | Pagination manuelle, instantané, fusion, cumuls, verrou et erreurs |
| `frontend/src/app/page.tsx` | Limites actuelles sur l’accueil |
| `frontend/src/app/conditions/page.tsx` | Limites actuelles et tentative consommée par page |
| `frontend/tests/search.test.tsx` | Adaptation des réponses simulées et tests du parcours de pagination |
| `README.md` | Usage, limites, critères et erreurs |
| `docs/youtube-api.md` | Contrat actuel, signatures, compteurs et erreurs |
| `docs/architecture.md` | Décision technique ouvrable dans Obsidian |
| `docs/validation.md` | Vérifications réelles et recette restante |
| `docs/codex-reports/phase-04.md` | Plan conservé, ajustements validés et présent rapport ajoutés |

Les répertoires temporaires de vérification ne constituent pas des fichiers livrés. Aucun changement de manifeste, lockfile, quota durable réel, configuration Compose, service OVH ou volume Docker.

## Tests réellement exécutés et résultats obtenus

| Vérification | Résultat réel |
| --- | --- |
| `python3 -m pytest backend -q` avec Python système | Échec initial : HTTPX absent |
| `/tmp/youfinder-venv/bin/python -m pytest backend -q` | **145 tests réussis**, Python 3.11.2, dépendances du lockfile existant |
| `npm test` depuis `frontend/`, Node 24.22.2 ARM64 | **44 tests réussis dans 4 fichiers** |
| `npm run typecheck` dans la copie `/tmp/youfinder-phase4-frontend` | **Réussi** après correction du typage d’un utilitaire de test |
| `npm run build` avec Turbopack dans cette première copie liée | Échec de résolution : dépendances en dehors de la racine |
| `npm run build` avec Turbopack dans `.phase4-validation`, copie isolée avec dépendances locales | **Réussi** : compilation, TypeScript et génération des pages |
| `git diff --check` | Réussi |

Les premières vérifications intermédiaires ont compté 143 tests backend et 43 tests frontend ; les résultats finaux ci-dessus comprennent les cas ajoutés ensuite. Aucun succès historique de phase 3 n’est utilisé comme validation de la phase 4. Les données sont simulées et aucun appel YouTube réel n’est effectué par ces tests.

Couverture : première et deuxième pages de 50, arrêt strict après deux pages, absence de jeton, doublons, ordre, pages entièrement filtrées, critères instantanés puis changés, filtres et dates UTC, quota épuisé, erreurs réseau et Google, double clic, conservation des résultats après erreur, reprise manuelle, réponses invalides et jetons opaques/invalides/répétés. Le backend refuse aussi une continuation altérée ou liée à d’autres critères sans consommer de tentative.

## Limites et problèmes rencontrés

- Les résultats YouTube peuvent changer entre appels ; la déduplication ne garantit ni ensemble figé ni exhaustivité. Les compteurs de traitement peuvent inclure une vidéo sur plusieurs pages, contrairement au nombre unique affiché.
- La continuation signée n’est pas à usage unique : une reprise de deuxième page peut être redemandée avec une nouvelle tentative consommée. Elle n’autorise aucun jeton de troisième page. Une nouvelle recherche peut toujours repartir de la première page. Aucun stockage de session n’a été introduit.
- Une rotation de clé invalide les continuations signées existantes. La clé elle-même reste exclusivement côté backend.
- Le solde affiché est la dernière valeur reçue et peut être périmé après une erreur ou un usage concurrent.
- Environnement Python système incomplet : recours à un venv temporaire installé depuis le lockfile. Python utilisé : 3.11.2, pas le 3.13.18 des images.
- Premier typecheck en échec sur le typage d’un mock, corrigé. Premier build temporaire en échec à cause du lien externe vers `node_modules`, résolu par une copie locale des dépendances avec liens internes préservés. Faute d’espace dans `/tmp`, cette copie de build a été créée temporairement dans le workspace puis retirée.
- Aucun test dans Compose, aucune recette visuelle navigateur, aucun contrôle des quotas effectifs du projet Google ni recherche YouTube réelle. Aucun déploiement.

## Vérifications prévues avant le retour de recette utilisateur (historique)

1. Exécuter les suites et le build dans l’environnement Docker habituel, sans supprimer de volume.
2. Vérifier dans le navigateur le consentement, l’accueil, le chargement initial, le bouton de deuxième page, les résultats conservés et les messages accessibles, y compris sur mobile.
3. Contrôler les cumuls et le nombre unique sur des doublons, l’état entièrement filtré, la fin de parcours et l’impossibilité de charger une troisième page.
4. Vérifier l’édition des champs avant continuation et la réinitialisation lors d’une nouvelle recherche.
5. Vérifier visuellement quota épuisé, erreur et reprise manuelle avec un environnement simulé. Tout essai réellement connecté à YouTube nécessite une autorisation distincte et consommera du quota.
6. Soumettre la recette à validation utilisateur. Aucun commit ou déploiement n’est créé automatiquement.


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
