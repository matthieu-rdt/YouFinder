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


# Décision phase 5 — tri local dérivé d’une liste source immuable

Date : 2026-11-04. Statut : plan validé par l’utilisateur, implémentation réalisée sur `feat/youtube-date-sorting`, recette manuelle restante.

La fonction pure `sortVideos()` dans `frontend/src/lib/video-sort.ts` trie une copie des vidéos uniques reçues. `result.items` conserve l’ordre initial dédupliqué des pages YouTube. Le frontend ajoute un seul état React pour le mode de tri et calcule la liste affichée au rendu, sans effet réseau ni seconde liste stockée à synchroniser. La limite de 100 identifiants ne justifie pas de cache de calcul supplémentaire.

L’analyse de `published_at` valide calendrier et fuseau, puis sépare secondes UTC entières et fraction décimale normalisée. La comparaison des fractions sous forme de chaînes conserve leur précision au-delà des millisecondes sans bibliothèque supplémentaire. Les dates égales et les dates invalides sont départagées par l’index de la liste source ; les invalides restent après toutes les dates valides dans les deux sens. Secondes intercalaires et année zéro sont traitées comme indisponibles, sans date de remplacement.

Le sélecteur natif est proche des cartes, hors du formulaire de recherche, et reste utilisable pendant une continuation. Les gestionnaires de recherche, pagination, fusion, déduplication et compteurs n’ont pas été modifiés. Le choix est conservé lors des nouvelles recherches et revient à la pertinence au remontage, sans persistance navigateur. Le tri concerne uniquement l’échantillon chargé, jamais une recherche exhaustive par date.

Aucun changement backend, contrat API, paramètre YouTube, quota, service, dépendance ou configuration Compose. Détails dans [[youtube-api]], vérifications dans [[validation]] et plan/bilan dans [[codex-reports/phase-05]].


# Décision phase 6 — présentation du dashboard et états de solde

Date : 2026-11-05. Architecture validée par l’utilisateur ; implémentation sur `feat/ui-dashboard`, recette utilisateur restante.

`SearchSummary` présente les compteurs cumulés déjà assemblés par `VideoSearch`, sans modifier leur calcul. `items.length` fournit seulement le nombre unique affiché. La barre retenues/écartées encode les compteurs de traitement ; les omissions restent distinctes. Aucun score, agrégat de statistiques YouTube ou nouveau champ API.

`DailyAttempts` reçoit le plafond, le solde et des indicateurs de présentation. Un état `balanceStale` mémorise une erreur HTTP, réseau ou de réponse invalide ; une réponse valide le réinitialise. Une simple erreur de saisie ne rend pas le solde périmé. Le dernier nombre connu reste visible, sans jauge après erreur, y compris pendant une reprise. Valeurs nulles/incohérentes : état inconnu ; plafond nul : texte sans jauge. Aucun décompte local, timer, stockage ou rafraîchissement réseau.

Le formulaire conserve ses validations, champs et conversions UTC. Les filtres restent dans un fieldset visible ; l’unique continuation est placée près du tri, avant la liste, conformément à l’ajustement validé. Les gardes de requête, critères instantanés, jetons, limite de deux pages, fusion, déduplication et fonction de tri restent identiques. Les seuls ajouts aux gestionnaires concernent l’état visuel de fraîcheur du solde.

Les effets React ajoutés servent uniquement au focus : résumé de pagination après disparition du bouton si l’utilisateur y était resté ; annulation de cette restauration en cas de déplacement pendant l’attente. Aucune requête dans ces effets. Le statut de chargement concis et l’alerte d’erreur sont séparés des cartes, qui ne sont plus dans une région live globale. Styles de focus communs et contrôles natifs, sans dépendance UI supplémentaire.

Décision lisible dans Obsidian ; preuves et limites dans [[validation]] et [[codex-reports/phase-06]]. Aucun backend, contrat API, module de tri, filtre métier, configuration Compose ou service modifié.


# Décision phase 6.1 — accueil compact et filtres natifs

Date : 2026-11-12. Plan et précisions validés par l’utilisateur ; implémentation sur `feat/ui-compact-search`, recette utilisateur restante.

L’en-tête réunit YouFinder et l’attribution officielle YouTube. Les introductions redondantes sont retirées ; les limites et le coût par page restent visibles sous forme compacte. Le solde inconnu initial devient une note, tandis que les composants de synthèse et de plafond après réponse restent inchangés.

Le fieldset de cinq filtres est désormais dans un `details/summary` natif fermé au premier montage. Les champs restent montés et activés : `FormData` continue de transmettre leurs valeurs sans conversion numérique. Seul le nombre de champs renseignés est stocké pour la présentation, mis à jour à la saisie, au montage et sur `pageshow` pour réconcilier une restauration native. Zéro compte, chaîne vide ne compte pas ; une valeur invalide renseignée compte sans autoriser la recherche. Les critères édités s’appliquent à la prochaine recherche, la continuation garde son instantané existant.

La validation HTML est conservée. Le formulaire intercepte `invalid` en capture, bloque l’affichage natif de l’erreur pour éviter de focaliser un champ masqué, ouvre le panneau et focalise le premier champ invalide. Un verrou limité au tour d’événements empêche les événements invalid suivants de voler le focus. Le message visible est une alerte ; `aria-invalid` et `aria-errormessage` relient le champ à l’erreur. Les gardes applicatives existantes ouvrent aussi le panneau avant de focaliser une date ou un seuil invalide. Aucune requête ni péremption du solde sur erreur locale.

Aucun état React d’ouverture, accordéon personnalisé, stockage navigateur, effet réseau ou nouvelle dépendance projet. Les champs non contrôlés conservent leurs valeurs sur la même page. La restauration éventuelle des champs par le navigateur ne constitue pas une persistance applicative des résultats ; le consentement reste contrôlé et requis. Backend, API, règles de filtres, tri, pagination, quota et Compose inchangés. La limitation de navigation légale observée en phase 6 n’est pas corrigée ici.

Contrôles Chromium avec données simulées, mesures, limites d’environnement et recette restante : [[validation]] et [[codex-reports/phase-06.1]].


# Décision phase 6.2 — synthèse statistique unique

Date : 2026-11-16. Plan validé par l’utilisateur sur `feat/ui-compact-summary` ; implémentation réalisée, recette utilisateur en attente. Cette décision remplace la présentation en panneaux et jauge de phase 6, sans modifier ses règles de solde.

`SearchSummary` constitue l’unique panneau statistique. Son `dl` affiche les trois valeurs déjà disponibles (examinées, retenues, uniques) et réutilise `DailyAttempts` comme quatrième cellule `dt`/`dd`. Les définitions sont reliées aux libellés par `aria-labelledby` et identifiants React `useId`. Deux colonnes sur mobile, quatre à partir de `sm` ; les nombres restent exacts et peuvent revenir à la ligne sans troncature.

Les retenues restent les cumuls avant déduplication ; les uniques proviennent de la liste déjà dédupliquée dans `VideoSearch`. Les écartées par filtres sont indiquées une fois, accompagnées de la seule barre décorative retenues/écartées et de son texte. Les omissions indisponibles restent séparées et conditionnelles. Aucun compteur métier recalculé, ratio analytique ou score nouveau.

`DailyAttempts` conserve les validations de solde/plafond et les qualifications de dernière réponse, dernier solde connu et péremption ; il ne possède plus de panneau ni de jauge. Les cas nul/inconnu et le plafond quotidien exact restent explicites. La synthèse porte l’aide commune sur le plafond interne, la journée Europe/Paris et l’absence d’actualisation automatique. Pas d’état, timer, stockage ni effet réseau nouveau.

Le groupe pagination/tri perd seulement son enveloppe `.panel` et réduit ses espacements. Le nombre de pages réussies apparaît une fois dans `paginationSummary`, qui conserve ref, `tabIndex`, emplacement avant le tri et restauration conditionnelle du focus. Les handlers, effets et gardes de `VideoSearch` sont inchangés. Les liens légaux et la limitation historique de perte des résultats au retour restent inchangés.

Mesures comparatives, tests et réserves : [[codex-reports/phase-06.2]] et [[validation]]. Aucun changement backend, API, filtre métier, quota, déduplication, tri ou Compose ; aucune dépendance ajoutée.
