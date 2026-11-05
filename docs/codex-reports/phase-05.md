# Plan de phase 05 — Tri chronologique local des résultats YouTube

État actuel : implémentation réalisée, tests automatisés réussis et recette fonctionnelle clôturée après validation manuelle des 9 scénarios par l’utilisateur le 2026-11-05. Le plan ci-dessous est conservé dans son état initial ; le rapport réel est ajouté à la fin du document.

## Plan initial conservé (avant validation)

Date : 2026-11-04. Projet : YouFinder.

**Statut : proposition soumise à validation. Aucune implémentation de phase 5 réalisée.**

## Objectif et périmètre

Permettre de changer l’ordre d’affichage des vidéos déjà chargées et retenues, sans nouvelle requête réseau ni consommation de quota liée au tri.

| Option proposée | Comportement |
| --- | --- |
| Pertinence YouTube (ordre initial) | Ordre de première apparition des vidéos dans les pages reçues |
| Date décroissante : plus récentes d’abord | Tri local selon `published_at` enrichi, du plus récent au plus ancien |
| Date croissante : plus anciennes d’abord | Tri local selon `published_at` enrichi, du plus ancien au plus récent |

Le tri porterait sur les vidéos uniques effectivement présentes en mémoire, issues d’une ou deux pages de 50 identifiants maximum. Il ne constituerait pas une recherche exhaustive des vidéos les plus récentes ou anciennes sur YouTube. Aucun score, métrique dérivée ou nouveau filtre ne serait introduit.

## Examen de l’existant

`AGENTS.md` a été lu. Branche active constatée avant rédaction : `feat/youtube-date-sorting`. Le répertoire de travail était propre avant création de ce plan.

**Fonctionnalités existantes constatées dans le frontend :**

- `VideoSearch` déclenche les requêtes exclusivement lors d’une soumission ou d’une continuation manuelle. Il conserve un instantané des critères et bloque les requêtes concurrentes.
- La fusion de la deuxième page ajoute les éléments à `result.items`, déduplique par identifiant et conserve la première occurrence dans l’ordre de réception.
- Le rendu parcourt directement `result.items`. Aucun état ni contrôle de tri n’existe actuellement.
- Les compteurs de traitement sont cumulés séparément de la longueur de la liste unique. Les résultats précédents restent disponibles après une erreur de continuation.
- `Video.published_at` est une chaîne ou `null`. La validation de réponse accepte les chaînes sans certifier leur validité temporelle.
- `VideoCard` affiche la publication via `formatDate`, avec présentation en UTC et état indisponible pour une valeur absente ou non interprétable. Cette présentation ne constitue pas un validateur strict du calendrier.
- Les filtres UTC, vues minimum, abonnés maximum et durée minimum font partie des critères soumis ; le tri local n’aurait pas à les modifier.

**Tests examinés :** `frontend/tests/search.test.tsx`, `dates.test.ts`, `page.test.tsx` et `video.test.tsx`. Ils couvrent notamment la pagination, les doublons, les compteurs, les erreurs, les filtres, les bornes UTC et l’absence de recherche au montage. Les tests de recherche simulent `fetch`. Les scripts frontend existants fournissent Vitest, TypeScript et le build Next.js.

Les résultats automatisés et la recette manuelle de phase 4 restent des preuves historiques de cette phase ; ils ne valident pas une fonctionnalité de tri encore proposée.

## Architecture proposée

### Une liste source conservée, une liste d’affichage calculée

Conserver `result.items` comme liste de référence dédupliquée, dans l’ordre YouTube de première apparition. Ne jamais trier ce tableau en place et ne pas remplacer son contenu par une version triée.

Ajouter un petit module frontend `frontend/src/lib/video-sort.ts` comprenant un type des trois modes et une fonction pure, par exemple `sortVideos(videos, mode)`. Celle-ci retournerait une nouvelle liste sans modifier le tableau source ni les objets vidéo.

Dans `VideoSearch`, un seul nouvel état React porterait le mode sélectionné, initialement « Pertinence YouTube ». La liste affichée serait dérivée de `result.items` et de ce mode au rendu ; aucun état supplémentaire ne conserverait une seconde copie synchronisée des résultats. Avec au plus 100 identifiants récupérés, un calcul direct reste suffisant et évite un effet React.

Le flux proposé serait : réponse enrichie et filtrée → fusion et déduplication existantes → liste source → tri local de présentation → cartes vidéo.

### Règles de comparaison

- Utiliser exclusivement `video.published_at`, jamais une date issue de `search.list`, un libellé localisé, le titre ou l’identifiant.
- Comparer des instants avec fuseau explicite, indépendamment du fuseau du navigateur. Deux représentations du même instant avec des décalages horaires différents seraient égales.
- Traiter `null`, une chaîne vide, un texte non interprétable, une date sans fuseau ou une date de calendrier impossible comme une date indisponible. Une validation du format et du calendrier serait prévue dans le module de tri : `Date.parse` seul peut accepter ou normaliser des entrées indésirables.
- Ne pas remplacer une date indisponible par zéro, la date courante ou une date inventée. La vidéo resterait affichée et aucun filtre ne serait appliqué par le tri.
- Placer les dates indisponibles après toutes les dates valides, dans les deux directions chronologiques. Préserver leur ordre source entre elles.
- Départager les dates égales par l’index de la vidéo dans la liste source, avec une comparaison stable explicite. L’égalité serait fondée sur l’instant complet pris en charge, pas sur le seul jour affiché. Les fractions de seconde seraient couvertes par les tests ; une éventuelle limite de précision serait documentée avant validation de l’implémentation.
- Pour « Pertinence YouTube », restituer une copie de la liste source sans comparaison de dates. Les vidéos sans date retrouveraient donc leur position initiale.

## Comportement du frontend proposé

Ajouter un sélecteur natif avec un libellé visible « Trier les vidéos chargées », placé près de la liste de résultats et hors du formulaire de recherche. Changer sa valeur ne soumettrait pas le formulaire et ne déclencherait aucun `fetch`.

Un texte proche préciserait : « Tri local des vidéos déjà chargées. Aucun nouvel appel YouTube. Ce tri ne recherche pas toutes les vidéos de YouTube par date. Les dates indisponibles sont placées à la fin des tris chronologiques. » L’avertissement de l’accueil serait ajusté pour que l’ordre YouTube y soit présenté comme l’ordre initial, compatible avec le tri local facultatif.

| Situation | Comportement proposé |
| --- | --- |
| Première visite ou rechargement | Mode par défaut : pertinence ; aucune recherche automatique |
| Changement de tri | Réordonner les cartes seulement ; conserver données, compteurs, jetons et solde |
| Chargement de la page 2 | Conserver le mode, fusionner et dédupliquer normalement, puis retrier l’ensemble chargé |
| Même date sur les deux pages | Première apparition de page 1 avant celle de page 2 à date égale |
| Retour à la pertinence après deux pages | Restaurer l’ordre source dédupliqué des deux pages |
| Erreur de page 2 | Conserver liste, tri sélectionné et compteurs acquis ; reprise manuelle existante |
| Nouvelle recherche soumise | Réinitialiser résultats, jetons et compteurs comme aujourd’hui ; conserver le mode de tri choisi pour la page ouverte |
| Liste vide ou entièrement filtrée | Aucun échec du tri ; conserver le message existant et la possibilité de continuation prévue |

Le choix de conserver aussi le tri lors d’une nouvelle recherche est une proposition de comportement soumise à validation avec ce plan. Il ne serait pas persisté dans le navigateur. Le sélecteur pourrait rester utilisable pendant une continuation : la réponse serait affichée selon le mode courant au moment du rendu, sans valeur de tri capturée dans la requête.

## Invariants de non-régression

- Aucun changement au backend, au contrat API, aux paramètres de `search.list` ou à son ordre de pertinence.
- Aucun paramètre de tri dans l’URL de recherche, les critères instantanés ou les signatures de continuation.
- Aucun appel réseau, retry, chargement anticipé ou réservation de quota pour changer de tri.
- Conservation de la limite de deux pages et de la déduplication existante, première occurrence conservée.
- Aucun recalcul des compteurs de traitement ni du solde quotidien par la fonction de tri.
- Conservation des filtres et du correctif temporel après enrichissement. Une date invalide serait traitée pour le classement local, sans changer les décisions de filtrage backend.
- Aucune dépendance supplémentaire, modification de service, volume Docker, secret ou intervention OVH.

## Fichiers concernés après validation

| Fichier | Intervention proposée |
| --- | --- |
| `frontend/src/lib/video-sort.ts` | Créer le type des modes, la comparaison des dates et la fonction pure de tri |
| `frontend/src/components/video-search.tsx` | Ajouter le sélecteur, son état, la liste dérivée et l’explication du tri local |
| `frontend/src/app/page.tsx` | Préciser ordre initial et tri local facultatif dans le texte de limites |
| `frontend/tests/video-sort.test.ts` | Créer les tests unitaires de logique métier |
| `frontend/tests/search.test.tsx` | Ajouter les tests d’interaction, pagination et absence d’appel au changement de tri |
| `frontend/tests/page.test.tsx` | Adapter la vérification de l’explication des limites si nécessaire |
| `README.md` | Documenter les trois options et leur portée locale |
| `docs/youtube-api.md` | Préciser que le tri local ne change pas les appels ni les quotas |
| `docs/architecture.md` | Consigner la séparation liste source / affichage, ouvrable dans Obsidian |
| `docs/validation.md` | Ajouter uniquement les vérifications effectivement réalisées après implémentation |
| `docs/codex-reports/phase-05.md` | Conserver ce plan et ajouter le rapport réel après implémentation |

Les types API de `frontend/src/lib/youtube.ts` et le composant `VideoCard` seraient réutilisés. Aucune modification de leur comportement n’est prévue dans ce périmètre.

**Pour la présente tâche, seul `docs/codex-reports/phase-05.md` est créé.**

## Tests prévus après validation

### Logique métier : fonction pure

1. Les trois modes sur une liste dont la pertinence diffère de l’ordre des dates.
2. Tableau source et objets inchangés après chaque tri ; retour à l’ordre initial après plusieurs changements.
3. Dates égales : ordre source stable dans les deux directions ; même jour avec heures différentes correctement ordonné.
4. Instants équivalents avec fuseaux différents, fractions de seconde et passage de jour UTC.
5. Dates absentes, vides, malformées, sans fuseau ou impossibles : fin de liste chronologique stable, aucune suppression ni valeur de remplacement.
6. Listes vide, à une vidéo ou entièrement sans date valide.

### Interactions et non-régression

1. Sélecteur correctement libellé, pertinence par défaut et explication du tri local visible.
2. Changement de tri après page 1 : nouvel ordre attendu, même nombre d’appels simulés, aucun paramètre ajouté, compteurs et solde identiques.
3. Deuxième page avec dates intercalées dans celles de la première : tri global conservé dans les deux directions, sans simple ajout en fin de liste triée.
4. Doublon entre pages : première occurrence conservée, une seule carte par identifiant et compteurs cumulés inchangés par rapport à la réponse.
5. Égalités entre pages et retour à la pertinence : ordre initial des premières occurrences restauré exactement.
6. Changement de mode pendant une deuxième page en attente : affichage final selon le dernier choix, sans requête additionnelle.
7. Erreur réseau ou quota épuisé lors de la continuation : résultats et mode conservés ; aucun retry automatique ni tentative induite par le tri.
8. Nouvelle recherche : tri sélectionné conservé selon la proposition, jetons et compteurs réinitialisés comme auparavant, aucun tri transmis au backend.
9. Page entièrement filtrée, fin de pagination et limite de deux pages inchangées.
10. Tests existants des filtres, dates UTC, consentement, doubles clics, affichage et absence d’appel au montage/remontage conservés.

Toutes les réponses seraient simulées. Après implémentation : exécuter les tests frontend, TypeScript et le build dans un environnement disponible sans perturber le cache de développement ; exécuter la suite backend existante comme contrôle de non-régression si l’environnement le permet, sans changer le backend. Consigner résultats et limites réels, sans annoncer à l’avance un nombre de tests ou leur réussite.

Recette manuelle prévue : comparer les trois options sur des résultats déjà chargés, vérifier le maintien du tri après page 2 et la restauration de la pertinence, puis constater l’absence d’appel réseau et la stabilité du solde lors des changements de tri. Aucun essai YouTube réel n’est requis pour les tests automatisés ni autorisé par cette tâche de planification.

## Risques et limites

- Les vidéos non chargées ou écartées par les filtres restent hors du classement. Le premier résultat du tri récent n’est pas nécessairement la vidéo la plus récente sur YouTube pour ce mot-clé.
- L’affichage des cartes indique un jour UTC alors que le tri compare les instants de publication ; deux cartes affichant le même jour peuvent avoir des positions différentes selon leur heure.
- Une conversion JavaScript permissive pourrait classer à tort une date invalide. La validation et les tests du calendrier et des fuseaux sont donc nécessaires ; la précision des fractions doit être explicitée lors de l’implémentation.
- Trier la liste source en place ferait perdre la pertinence et affecterait la stabilité après pagination. La fonction pure et les tests de non-mutation préviennent ce risque.
- Une égalité de date doit toujours être résolue depuis l’ordre source, jamais depuis le dernier ordre affiché.

## Étapes proposées

1. Attendre la validation de ce plan, notamment du placement des dates indisponibles et de la conservation du mode lors d’une nouvelle recherche.
2. Implémenter la fonction pure et ses tests métier, sans dépendance supplémentaire.
3. Ajouter le sélecteur et le rendu dérivé, sans toucher à la récupération ni à la déduplication.
4. Ajouter les tests d’interaction et exécuter les vérifications de non-régression disponibles.
5. Actualiser la documentation technique et compléter ce rapport avec les changements et résultats réellement obtenus.
6. Présenter les résultats pour recette utilisateur, sans commit automatique ni déploiement.

## Vérifications effectuées pour ce plan

Lecture de `AGENTS.md`, examen du frontend et de ses tests, contrôle de la branche et de l’état Git. Aucune suite de tests ou build relancé : cette intervention est uniquement documentaire. Aucun code modifié, aucune recherche YouTube, aucun commit créé et aucune intervention OVH.

---

# Rapport d’implémentation — Phase 05

Date : 2026-11-04. Statut : implémentation réalisée après validation utilisateur ; vérifications automatisées réussies, recette navigateur restante.

Le plan initial ci-dessus est conservé comme historique. L’utilisateur a validé les trois modes, les dates indisponibles en fin de liste, la conservation du mode après page 2 et nouvelle recherche, et son retour à la pertinence après rechargement, sans stockage navigateur. Conformément à sa consigne explicite, le rapport est ajouté à ce même fichier, sans créer de fichiers de plan et rapport séparés.

## Modifications réellement effectuées

- Branche vérifiée avant modification : `feat/youtube-date-sorting`. La modification préexistante de `AGENTS.md` a été préservée ; ce fichier n’a pas été édité pour cette phase.
- Création de `frontend/src/lib/video-sort.ts` : type des trois modes et fonction pure `sortVideos()`, acceptant un tableau en lecture seule et retournant une nouvelle liste. Les objets vidéo et le tableau source ne sont jamais modifiés.
- Comparaison exclusive de `video.published_at`. La validation vérifie format, fuseau explicite et calendrier avant conversion en secondes UTC. La fraction décimale reste une chaîne normalisée, sans arrondi flottant : les différences inférieures à une milliseconde restent ordonnées correctement.
- Dates absentes, vides, sans fuseau ou invalides en fin des deux tris chronologiques. Leur ordre relatif et celui des instants égaux suivent l’index dans la liste source. Aucune vidéo supprimée ni date inventée.
- Ajout du sélecteur natif « Trier les vidéos chargées », hors du formulaire de recherche et près des cartes, avec libellé visible, description accessible et explication de la portée locale.
- Ajout d’un seul état React pour le mode ; liste affichée calculée au rendu depuis `result.items`. Aucun effet, appel réseau ou stockage navigateur ajouté.
- Conservation du mode après deuxième page, erreur et nouvelle recherche ; retour au mode initial lors d’un remontage complet. Le sélecteur reste utilisable pendant une continuation et le rendu applique le dernier choix.
- Restauration exacte de la pertinence depuis la liste source, y compris après pagination et doublons. Les gestionnaires de chargement, fusion, déduplication, filtres et compteurs sont inchangés. Aucun paramètre de tri n’est transmis au backend ou à YouTube.
- Actualisation de l’explication sur l’accueil, du README et des documents techniques.

## Fichiers créés et modifiés

| Fichier | Intervention réelle |
| --- | --- |
| `frontend/src/lib/video-sort.ts` | Créé : validation des dates, comparaison stable et tri pur |
| `frontend/tests/video-sort.test.ts` | Créé : 16 tests métier avec données simulées |
| `frontend/src/components/video-search.tsx` | Modifié : état du mode, liste dérivée, sélecteur et explication locale |
| `frontend/src/app/page.tsx` | Modifié : préciser ordre initial et tri local facultatif |
| `frontend/tests/search.test.tsx` | Modifié : 8 cas d’intégration du tri et de ses interactions |
| `frontend/tests/page.test.tsx` | Modifié : assertion sur l’explication du tri local |
| `README.md` | Modifié : modes, limites, conservation et absence de quota au changement |
| `docs/youtube-api.md` | Modifié : comportement frontend et contrat/API inchangés |
| `docs/architecture.md` | Modifié : décision technique ouvrable dans Obsidian |
| `docs/validation.md` | Modifié : vérifications réellement exécutées et recette restante |
| `docs/codex-reports/phase-05.md` | Plan conservé et présent rapport ajouté |

Aucun fichier backend, configuration Compose, manifeste ou lockfile modifié. Le dossier `.phase5-validation` a été créé uniquement pour les vérifications puis retiré ; il ne fait pas partie des fichiers livrés.

## Tests exécutés et résultats

| Commande et environnement | Résultat réel |
| --- | --- |
| `npm test` depuis `frontend/`, Node 24.22.2 ARM64 | **68 tests réussis dans 5 fichiers** |
| `npm run typecheck` dans `.phase5-validation` | **Réussi** |
| `NEXT_TELEMETRY_DISABLED=1 npm run build` dans `.phase5-validation` | **Réussi avec Next.js 16.4.3 / Turbopack**, compilation, TypeScript et génération statique |
| `/tmp/youfinder-venv/bin/python -m pytest backend -q` | **145 tests réussis**, Python 3.11.2 |
| `git diff --check` | Réussi |

La suite frontend a été exécutée une première fois puis relancée après le renforcement de la validation de fin de chaîne et de l’assertion de l’accueil ; les deux exécutions ont réussi avec 68 tests. Le typecheck et le build ont porté sur la version finale du code et des tests, dans une copie isolée avec les dépendances existantes et leurs liens internes préservés. Aucun cache `.next` du serveur en cours n’a été remplacé. Aucun package n’a été installé dans cette phase.

Les 24 nouveaux cas frontend comprennent : trois modes ; absence de mutation ; dates égales et fuseaux équivalents ; heures et changement de jour UTC ; fractions longues et inférieures à une milliseconde ; dates absentes, invalides, impossibles ou sans fuseau ; calendrier bissextile et années anciennes ; listes vides ou sans date ; absence de requête au changement de tri ; stabilité des compteurs ; tri global après page 2 et déduplication ; retour à la pertinence ; changement de mode pendant la requête ; erreurs réseau/quota ; nouvelle recherche et remontage ; page entièrement filtrée puis continuation.

Les tests existants de phase 4 restent exécutés, notamment pagination stricte à deux pages, filtres, dates UTC, consentement et doubles clics. Les résultats de cette phase sont distincts de ceux de la recette manuelle de phase 4. Les données sont simulées et les appels interceptés : aucune recherche YouTube réelle ni consommation de quota réel.

## Problèmes rencontrés

Aucun échec de test, typecheck ou build rencontré lors de cette implémentation. Les exécutables Node et Python temporaires déjà disponibles ont été réutilisés. Pour préserver le cache de développement et disposer de dépendances à l’intérieur de la racine de résolution Turbopack, les vérifications TypeScript et build ont utilisé `.phase5-validation` dans le workspace, où l’espace disponible permettait la copie. Cette copie a été retirée après vérification.

La nouvelle convention générale de rapports dans `AGENTS.md` diffère du nommage demandé explicitement pour cette phase. La consigne utilisateur de conserver plan et bilan dans `docs/codex-reports/phase-05.md` a été appliquée, sans éditer `AGENTS.md`.

## Limitations

- Le classement concerne seulement les vidéos chargées et retenues ; il ne recherche pas les vidéos globalement les plus récentes ou anciennes de YouTube.
- La comparaison traite les années 0001 à 9999, un fuseau explicite et les secondes 00 à 59. Une seconde intercalaire (`:60`) est considérée comme date indisponible. Aucune date de remplacement.
- Les cartes affichent le jour UTC, alors que le tri compare l’instant complet ; deux jours affichés identiques peuvent correspondre à des heures distinctes.
- Le formateur historique des cartes n’a pas été modifié et reste plus permissif que le validateur du tri. Une chaîne invalide normalisée par ce formateur peut être affichée comme un jour tout en étant classée parmi les dates indisponibles.
- Les vérifications ont été exécutées hors des conteneurs Compose, avec Python 3.11.2 plutôt que le 3.13.18 des images. Elles ne remplacent pas une validation dans l’environnement Docker habituel.
- Aucun essai visuel navigateur de phase 5 ni recherche YouTube réelle. Aucun changement OVH, volume Docker, secret, commit ou déploiement.

## Recette manuelle initialement prévue (avant le retour utilisateur)

1. Vérifier le sélecteur, son texte de portée locale et son utilisation au clavier et sur mobile.
2. Sur des vidéos déjà chargées, comparer les trois modes et vérifier le retour exact à la pertinence ; contrôler dans les outils réseau qu’un changement de tri ne produit aucun appel et ne change pas le solde.
3. Charger manuellement la page 2 en conservant un tri chronologique, contrôler l’ordre global et les doublons, puis restaurer la pertinence. Vérifier les compteurs cumulés et le nombre de vidéos uniques.
4. Changer le mode pendant une continuation et vérifier que le dernier choix s’applique à l’arrivée des résultats.
5. Lancer une nouvelle recherche : mode conservé, résultats/jetons/compteurs réinitialisés selon le comportement existant. Recharger complètement : pertinence par défaut et aucune recherche automatique.
6. Avec des réponses simulées, vérifier dates invalides ou manquantes, égalités, page entièrement filtrée et erreur de continuation, sans perte des résultats précédents.
7. Exécuter si souhaité les suites et le build dans Compose, sans supprimer de volume. Tout essai réellement connecté à YouTube exige une autorisation distincte et consommera du quota ; il n’a pas été effectué ici.


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
