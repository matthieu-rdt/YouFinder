# Phase 6.2 — Synthèse compacte des statistiques

## Statut et périmètre

Plan initial du 16 novembre 2026, **en attente de validation avant implémentation**. Ce plan doit rester dans ce fichier ; les décisions validées, le bilan, les résultats et la recette seront ajoutés ensuite.

Lecture de `AGENTS.md` effectuée. Branche vérifiée : `feat/ui-compact-summary`, HEAD `53e3cac`. État Git initial propre. Cette intervention ne crée que ce rapport : aucun code applicatif modifié, test applicatif ou navigateur exécuté, appel YouTube réel, commit, déploiement, suppression de volume ou changement de service.

Contraintes : présentation frontend uniquement ; aucun changement backend, contrat API, compteur métier, filtre, tri, déduplication, consentement, critère soumis, jeton, consommation ou logique de pagination. Aucun changement Compose, aucune dépendance nouvelle, aucun accès OVH. Conserver le fonctionnement des liens légaux et ne pas ajouter de persistance.

## Audit statique de l’existant

Sources examinées : les trois composants concernés, `frontend/src/lib/youtube.ts`, `frontend/src/app/globals.css`, `frontend/src/app/page.tsx`, les tests `search-summary`, `daily-attempts`, `search`, `page`, leur configuration de nettoyage et `frontend/package.json`. Consultation des rapports des phases 6 et 6.1 pour leurs validations et réserves historiques.

### Composants et flux

- `search-summary.tsx` : panneau contenant trois cartes de traitement, un paragraphe répétant leurs nombres, une barre décorative avec une légende numérique répétée, puis deux cartes (uniques et pages), un texte répétant les uniques et deux badges de pages. Les omissions apparaissent seulement si positives. La barre est absente à zéro examiné et son périmètre avant déduplication est explicite.
- `daily-attempts.tsx` : second panneau, explications du plafond interne, solde numérique avec plafond, jauge native et aide sur le coût. Validation locale des entiers sûrs, bornes et valeurs nulles. `stale` conserve le dernier solde mais masque la jauge ; `pending` qualifie le solde comme dernier connu. Un plafond nul a un message spécifique.
- `video-search.tsx` : cumule les compteurs des réponses validées et déduplique les cartes par identifiant. Transmet `result.items.length` comme nombre unique et `pages` comme nombre de pages réussies. Les compteurs de traitement restent avant déduplication ; le solde et le plafond proviennent de la dernière réponse, sans addition.
- Un troisième panneau « Organisation et pagination des résultats » précède les cartes : notice API, compteur de pages répété, coût/critères, bouton de continuation, fin de parcours et tri local. Le paragraphe `paginationSummary` est une cible de focus après disparition du bouton en page 2 ; ce n’est pas un texte à supprimer sans remplacement.
- Avant résultat valide, aucun des deux panneaux statistiques n’est monté : un texte annonce le solde inconnu. Une nouvelle soumission efface `result` ; une erreur de continuation conserve le résultat et marque le solde périmé. Ne pas introduire un historique du solde à cette occasion.
- `isSearchResponse` exige des compteurs entiers sûrs non négatifs, un solde inférieur ou égal au plafond, et, par réponse, `examined = retained + filtered_out`, `retained = items.length`, `examined + omitted <= 50`. Les omissions sont donc distinctes du traitement examiné. Après agrégation, les uniques peuvent être inférieurs aux retenues.
- La classe partagée `.panel` apporte bordure et padding de 16 à 24 px. Les cartes et espacements internes s’y ajoutent. Les KPI actuels sont empilés sous le breakpoint `sm`. Les règles `.quota-meter` ne servent qu’à la jauge quotidienne.

### Problèmes UX identifiés

Les statistiques occupent deux panneaux et cinq cartes internes. Les trois compteurs de traitement sont affichés jusqu’à trois fois ; les uniques et les pages sont répétés. Le troisième panneau repousse encore la première vidéo. À petite largeur, l’empilement accentue cette structure ; aucune hauteur chiffrée ne peut être conclue de cette lecture statique.

La jauge quotidienne exprime le même solde et le même plafond que le texte adjacent. Elle n’apporte pas une seconde dimension utile et peut suggérer une fraîcheur supérieure à celle de la dernière réponse. Proposition : la retirer dans tous les états, tout en préservant les nombres, leur nom accessible et leur qualification.

Les tests actuels garantissent des comportements utiles mais plusieurs assertions ciblent les paragraphes redondants, les badges et le rôle `meter`. Ils devront être remplacés par des assertions sémantiques équivalentes, sans supprimer les scénarios.

## Architecture proposée

### Un seul panneau statistique

Réutiliser `SearchSummary` comme unique enveloppe `.panel`, avec un titre bref et un `dl` de quatre indicateurs. Deux colonnes à 375 px, quatre sur desktop lorsque l’espace le permet ; pas de hauteur fixe, de troncature des nombres ou de réduction globale de police. Les libellés peuvent revenir à la ligne.

Réutiliser `DailyAttempts` comme quatrième cellule du `dl` (conteneur `div` avec `dt`/`dd`), sans section ni carte autonome. Il conserve sa validation et les états `stale`/`pending`. `SearchSummary` recevrait les valeurs de solde/plafond et ces deux drapeaux par props de présentation. Aucun nouveau composant nécessaire, aucun état ni calcul métier supplémentaire.

| Indicateur principal | Source exacte existante | Sens |
| --- | --- | --- |
| Vidéos examinées | `result.examined_count` | Cumul des pages traitées |
| Vidéos retenues | `result.retained_count` | Cumul avant déduplication |
| Vidéos uniques affichées | `uniqueCount`, transmis depuis `result.items.length` | Cartes après déduplication |
| Tentatives YouFinder restantes | `result.searches_remaining` | Solde de la dernière réponse valide |

Le quatrième indicateur garde aussi `daily_limit` visible (« sur N aujourd’hui »), et une qualification « Solde de la dernière réponse » ou « Dernier solde connu ». Aucun arrondi, pourcentage numérique nouveau, soustraction de doublons ou estimation du quota Google.

### Informations secondaires et barre

- Une seule mention numérique « Vidéos écartées : N », servant aussi de légende à la barre retenues/écartées ; la mention des retenues renvoie au KPI et ne répète pas sa valeur. Différencier les segments par des noms textuels, sans dépendre de la couleur. La barre reste décorative (`aria-hidden`) puisque les valeurs exactes sont dans le texte.
- Une seule barre calculée avec les proportions existantes `retained_count / examined_count` et `filtered_out_count / examined_count`, uniquement si le dénominateur est positif. Aucune inclusion des omissions dans cette barre.
- Une phrase courte, sans nombres répétés : « Cumuls des pages traitées avant déduplication ; les vidéos uniques excluent les doublons entre pages. »
- Omissions seulement si `omitted_count > 0`, avec leur nombre exact et la distinction indisponibilité/exclusion par filtre.
- Une aide quotidienne concise : plafond interne distinct du quota Google YouTube, journée Europe/Paris, une tentative par page demandée, solde non actualisé en temps réel et aucun rafraîchissement automatique. Conserver l’avertissement de péremption après erreur ; retirer toute référence à une jauge masquée.

### Pages et organisation des résultats

Ne pas déplacer la logique de pagination. Supprimer les cartes/badges de pages de `SearchSummary` et conserver **une seule mention « N page(s) chargée(s) sur 2 maximum » dans le paragraphe existant `paginationSummary`**, juste après la synthèse. Ce choix garde une information secondaire compacte et préserve la cible de focus avant le tri. La synthèse et ce repère forment un parcours continu, sans répétition numérique.

Retirer l’enveloppe visuelle `.panel` du bloc d’organisation, en conservant son nom accessible, son titre, sa notice API, ses avertissements, le bouton, la cible de focus et le sélecteur. Réduire prudemment ses espacements. Il reste un groupe fonctionnel distinct, sans devenir un nouveau panneau statistique. Ne pas réécrire les messages d’erreur ou les conditions des messages de fin, même si une borne de parcours y est rappelée pour expliquer une action indisponible.

Le texte de solde inconnu avant résultat reste dans son parcours actuel : aucun faux KPI zéro avant une réponse valide. La consolidation de présentation ne doit changer ni les handlers, ni les effets, ni les gardes ou l’ordre fonctionnel bouton → résumé → tri → cartes.

## Cas limites et garanties

| Cas | Affichage et comportement attendus |
| --- | --- |
| Zéro examiné | KPI zéro exacts, pas de division ni barre, message explicite d’absence de répartition |
| Aucune retenue / entièrement filtré | Retenues et uniques zéro ; écartées exactes, barre entièrement écartée si examinées positives ; continuation autorisée selon les gardes existantes |
| Tout retenu | Segment retenues complet, écartées zéro affiché sans division invalide |
| Doublons entre pages | Retenues cumulées inchangées, uniques issus des cartes ; distinction textuelle permanente |
| Omissions | Aucune mention à zéro ; sinon nombre exact séparé des filtres et de la barre |
| Solde restant nul, plafond positif | Zéro visible, plafond conservé ; bouton de continuation toujours désactivé selon la logique actuelle |
| Solde inconnu ou valeurs invalides | « Solde inconnu », jamais zéro inventé ; conserver les contrôles null, entier sûr, bornes et cohérence dans `DailyAttempts` |
| Erreur de continuation | Résultats/compteurs/pages inchangés, alerte conservée, dernier solde connu marqué potentiellement périmé |
| Requête en attente | Ancien solde qualifié comme dernier connu, annonces et cartes conservées ; aucune décrémentation anticipée |
| Succès après erreur | Nouveau solde exact, qualification de péremption retirée par le flux existant |
| Plafond quotidien nul | `0 sur 0`, message de capacité nulle, aucun ratio quotidien |
| Erreur initiale ou après nouvelle soumission | Alerte et solde inconnu selon le flux existant ; pas de réapparition d’anciens résultats |

## Accessibilité et responsive

Conserver les noms complets des indicateurs avec paires `dt`/`dd`, dont « Tentatives YouFinder restantes » auparavant porté par la jauge. Associer les précisions de fraîcheur au nombre par structure sémantique ou description accessible. Conserver les nombres en texte, sans suffixes abrégés ni valeurs disponibles uniquement au survol.

Ne pas ajouter d’annonce live sur toutes les cartes ou tous les compteurs : conserver `role=status` et `role=alert` existants. Préserver la restauration du focus et l’absence de reprise forcée si l’utilisateur rejoint le tri pendant la requête. Vérifier clavier, focus visible, retours à la ligne, contrastes, reflow et absence de débordement à 375 px ; 320 px et zoom natif 200 % en complément. Un viewport simulé ne vaut pas validation sur mobile réel ou lecteur d’écran.

## Fichiers concernés après validation

| Fichier | Modification prévue |
| --- | --- |
| `frontend/src/components/search-summary.tsx` | Enveloppe unique, quatre indicateurs, barre et aides compactes, retrait des répétitions |
| `frontend/src/components/daily-attempts.tsx` | Cellule réutilisable, retrait de la jauge, conservation des validations et qualifications |
| `frontend/src/components/video-search.tsx` | Composition et props uniquement ; repère de pages unique et enveloppe d’organisation allégée |
| `frontend/src/app/globals.css` | Retrait éventuel des seules règles `.quota-meter` devenues inutilisées, sans toucher `.panel` globalement |
| `frontend/tests/search-summary.test.tsx` | Structure, chiffres, répartition et limites |
| `frontend/tests/daily-attempts.test.tsx` | Assertions numériques/accessibles remplaçant la jauge et couverture des états |
| `frontend/tests/search.test.tsx` | Assertions sémantiques et intégration sans perte des garanties |
| `README.md`, `docs/architecture.md`, `docs/validation.md` | Usage, décision de composition et validations réelles, liens compatibles Obsidian |
| `docs/codex-reports/phase-06.2.md` | Plan conservé, décisions puis bilan et recette ajoutés |

Aucune modification de `youtube.ts`, des tests métier de tri/dates, des pages légales, du backend ou de Compose prévue. Les suites existantes restent à exécuter intégralement.

## Tests prévus et critères de validation

1. `search-summary.test.tsx` : quatre noms accessibles et nombres exacts ; écartées/pages sans cartes redondantes ; omissions conditionnelles ; différences retenues/uniques ; zéro, tout retenu, tout écarté ; absence de NaN/Infinity ; une barre seulement et aucune jauge quotidienne.
2. `daily-attempts.test.tsx` : garder tous les scénarios actuels en remplaçant le contrat visuel `meter` par le contrat nombre/libellé/plafond/qualification. Conserver nulls, valeurs négatives, solde supérieur au plafond, bornes, plafond nul, stale et pending ; ajouter fractions, valeurs non sûres et non finies si absentes.
3. `search.test.tsx` : remplacer les assertions sur paragraphes supprimés par lecture des valeurs associées à leurs libellés. Vérifier toujours cumuls, uniques après doublons, reset sur nouvelle recherche et invariance des compteurs pendant le tri. Adapter explicitement le scénario « restaure la jauge » en « actualise le solde qualifié après succès », en conservant les étapes erreur/reprise/succès et les trois appels simulés.
4. Préserver intégralement les scénarios consentement, filtres combinés et précision, critères soumis figés, jetons/signatures, deux pages manuelles, double clic, erreurs/quota, réponse invalide, conservation des résultats, tri stable, focus de pagination et absence de requête automatique. Conserver `page.test.tsx`, dates et tri dans la suite complète.
5. Dans `frontend/` : `npm test`, `npm run typecheck`, `NEXT_TELEMETRY_DISABLED=1 npm run build` (Turbopack par défaut dans ce projet). Consigner environnement, commandes, sorties et limitations. Un build Webpack de dépannage ne valide pas le critère Turbopack. Aucun changement de service existant pour ces contrôles.
6. Recette navigateur sur données entièrement simulées : succès une/deux pages, doublons, tout filtré, zéro examiné, omissions, solde nul, plafond nul, état initial inconnu, erreur puis reprise différée. Intercepter `/api/videos/search` avant toute soumission, bloquer les autres accès réseau externes, ne pas utiliser de clé YouTube. La validation locale doit échouer si une recherche échappe au mock. Ne pas suivre les liens YouTube pendant la recette ; vérifier leurs attributs et les liens légaux locaux.
7. Vérifier au navigateur les nombres accessibles, le clavier (Tab/Maj+Tab/Entrée/Espace), focus après page 2 et déplacement volontaire vers le tri, alertes, consentement et liens légaux. Pas de changement du comportement historique au retour des pages légales.

Validation attendue : un panneau statistique, quatre indicateurs lisibles, une barre maximum, aucune jauge quotidienne, aucun chiffre fabriqué, toutes les garanties fonctionnelles conservées, tests/types/build réussis ou blocages explicitement ouverts. La recette utilisateur reste distincte de la recette automatisée.

## Protocole de mesures UX avant/après

**Aucune mesure exécutée pour ce plan.** Les mesures de phase 6.1 portaient sur le début de la synthèse, pas sur la première vidéo : elles ne constituent pas une référence chiffrée pour cette phase.

Avant toute implémentation, conserver une référence des sources actuelles dans un emplacement temporaire autorisé, sans modifier la branche ni créer de commit. Servir les deux versions dans le même environnement, avec mêmes navigateur/version, moteur de build, polices chargées, viewport, zoom natif 100 %, scroll initial, filtres fermés, mot-clé et consentement. Employer exactement les mêmes fixtures simulées et attendre le rendu stabilisé. Ne pas mesurer une version dev face à une version production.

Viewports principaux : **375 × 900** et **1440 × 900** pixels CSS. Compléments 320 px, tablette et zoom 200 % pour le reflow. Fixture principale : première page avec au moins une carte et continuation disponible ; seconde fixture avec deux pages et doublon. Garder titres, notices et compteurs identiques entre les versions.

- Hauteur statistique : avant, distance du haut de `SearchSummary` au bas de `DailyAttempts`, incluant l’espace entre eux ; après, rectangle du panneau unique. Relever aussi séparément la hauteur du groupe d’organisation pour rendre visible un éventuel déplacement du contenu.
- Première vidéo : position documentaire du premier `article` (`getBoundingClientRect().top + scrollY`), pas le titre « Résultats » ni le début de la synthèse. Relever aussi la distance entre début de synthèse et première carte. Si aucun résultat, noter « sans objet » et mesurer séparément le message vide.
- Panneaux : compter les enveloppes visuelles de premier niveau entre début de synthèse et première vidéo, puis celles qui intersectent le viewport initial ; ne pas confondre cartes KPI internes et panneaux. Structure source actuelle : deux statistiques + un d’organisation ; observation visuelle encore à effectuer. Cible : un statistique et groupe d’organisation sans panneau.
- Relever les débordements horizontaux et la lisibilité des quatre cellules sur mobile et desktop. Conserver captures avant/après et valeurs brutes dans les artefacts de validation disponibles, avec chemins et environnement dans le bilan.

| Scénario | Viewport | Hauteur statistiques avant/après | Y première carte avant/après | Panneaux avant/après | Débordement |
| --- | --- | --- | --- | --- | --- |
| Une page avec continuation | 375 × 900 | À mesurer | À mesurer | À observer | À vérifier |
| Une page avec continuation | 1440 × 900 | À mesurer | À mesurer | À observer | À vérifier |
| Deux pages avec doublon | 375 × 900 | À mesurer | À mesurer | À observer | À vérifier |
| Deux pages avec doublon | 1440 × 900 | À mesurer | À mesurer | À observer | À vérifier |

Critère UX : hauteur statistique strictement réduite et première carte remontée dans les quatre comparaisons, sans perte de sens, de chiffres ou de lisibilité. Aucun pourcentage de gain promis avant mesures. Les états d’erreur peuvent légitimement ajouter de la hauteur ; les comparer séparément à état identique.

## Risques et limitations

- Réduire les aides à l’excès pourrait confondre cumuls et uniques, omissions et exclusions, quota interne et quota Google : ces distinctions restent visibles.
- Le déplacement du repère de pages pourrait casser le focus : le plan le conserve à sa place fonctionnelle, avec sa ref et `tabIndex`.
- La suppression du rôle `meter` exige de préserver explicitement le nom et le nombre accessibles, pas de supprimer simplement les tests de jauge.
- Les libellés longs peuvent augmenter la hauteur à 375 px : tester les retours à la ligne sans écraser les cibles ou masquer des valeurs.
- L’environnement a historiquement empêché certains builds Turbopack locaux et accès Docker. La phase 6.1 a un build Docker confirmé par l’utilisateur ; ce résultat historique ne valide pas la phase 6.2. Toute nouvelle limitation doit être rapportée sans résultat inventé ni changement Compose.
- Mobile réel, Safari et lecteur d’écran restent des réserves historiques à distinguer des contrôles Chromium simulés. La perte d’état au retour d’une page légale reste hors périmètre.
- Aucun contrôle de conformité supplémentaire nécessaire pour ce plan de présentation : aucun nouveau calcul de métrique YouTube ni nouveau traitement de données n’est proposé.

## Plan d’implémentation soumis à validation

1. Obtenir la validation de ce plan ; relever de nouveau branche et état Git.
2. Préparer et mesurer la référence navigateur avec API simulée, avant de modifier les composants.
3. Simplifier `DailyAttempts`, l’intégrer comme quatrième indicateur de `SearchSummary`, puis supprimer les répétitions et la jauge.
4. Adapter uniquement la composition dans `VideoSearch` et alléger le groupe d’organisation en conservant le repère de pages et ses comportements.
5. Adapter et compléter les tests sémantiques ; exécuter suite frontend, TypeScript, build Turbopack et recette navigateur comparative.
6. Mettre à jour README et documents techniques utiles ; compléter ce même rapport avec fichiers réellement modifiés, décisions, mesures, tests, problèmes et limites.
7. Présenter le résultat et la recette utilisateur, sans commit ni déploiement automatique.

## Journal de réalisation et recette

- Plan initial : rédigé ; validation utilisateur en attente.
- Implémentation : non commencée.
- Tests frontend, TypeScript, build et recette navigateur de phase 6.2 : non exécutés.
- Mesures avant/après : non exécutées.
- Contrôles documentaires : `git diff --check` réussi ; `git diff --no-index --check /dev/null docs/codex-reports/phase-06.2.md` sans diagnostic de whitespace (code 1 attendu pour un fichier nouveau). `git status --short` confirme que seul ce rapport non suivi a été ajouté.
- Recette utilisateur : non commencée ; à renseigner après implémentation et retour utilisateur, avec les réserves non testées conservées.

## Décisions validées et réalisation — 16 novembre 2026

Le plan initial ci-dessus est conservé. L’utilisateur a explicitement autorisé son implémentation : panneau unique de quatre indicateurs, une seule barre, suppression de la jauge quotidienne, pages indiquées une fois, omissions conditionnelles, réutilisation des trois composants et préservation du focus. Aucun changement de périmètre métier.

Avant modification : `AGENTS.md` relu, branche `feat/ui-compact-summary` confirmée, HEAD `53e3cac`. Seul le présent rapport était non suivi ; les sources étaient propres. Les 97 tests frontend ont été exécutés avec succès et les quatre mesures de référence ont été réalisées avant la première modification applicative.

### Modifications réellement réalisées

- `SearchSummary` : une enveloppe statistique, un titre et un `dl` de quatre indicateurs ; deux colonnes sur petit écran, quatre à partir de `sm`. Les valeurs ne sont ni abrégées ni tronquées ; les grands entiers peuvent revenir à la ligne. Libellés `dt` associés aux `dd` par identifiants React `useId` et `aria-labelledby`.
- `DailyAttempts` : cellule de présentation du quatrième indicateur, sans panneau indépendant ni jauge. Entiers sûrs, bornes, valeurs nulles/incohérentes, solde nul et plafond nul conservés. Le dernier solde connu reste exact pendant une requête et après erreur ; la péremption reste explicite jusqu’au succès suivant. Le plafond reste numérique et visible. Le message de plafond nul est aussi maintenu en combinaison avec `stale`.
- La seule barre reste décorative et limitée aux cumuls retenues/écartées. Les chiffres et leur sens sont lisibles sans couleur. Aucun nouveau ratio analytique, score ou métrique. À zéro examiné, pas de division ni de barre.
- Écartées indiquées une fois comme exclusions par filtres ; omissions signalées uniquement si positives, comme indisponibilités distinctes. Suppression des paragraphes de chiffres répétés et badges de pages.
- `VideoSearch` : changement de composition seulement, transmission de `stale` et `pending` par la synthèse. Le groupe pagination/tri perd son enveloppe `.panel` et réduit son espacement de 16 à 12 px. Le compteur de pages reste dans son paragraphe initial, avec ref, `tabIndex`, position et logique de focus inchangés. Tous les handlers et effets restent identiques.
- Styles devenus inutiles de `.quota-meter` retirés ; classe `.panel` commune inchangée.
- Tests adaptés à la lecture des indicateurs, sans suppression de scénario fonctionnel. Ajouts : structure unique, qualification intégrée, données de solde invalides supplémentaires, grand entier sûr, plafond nul périmé, état inconnu après erreur initiale, plafond nul dans la recherche et solde conservé pendant une continuation sans erreur.

### Fichiers réellement modifiés

| Fichier | Résultat |
| --- | --- |
| `frontend/src/components/search-summary.tsx` | Synthèse unique et compacte |
| `frontend/src/components/daily-attempts.tsx` | Solde intégré sans jauge |
| `frontend/src/components/video-search.tsx` | Composition et groupe pagination/tri allégé |
| `frontend/src/app/globals.css` | Suppression des quatre règles de jauge inutilisées |
| `frontend/tests/search-summary.test.tsx` | Valeurs, sémantique, barre et limites |
| `frontend/tests/daily-attempts.test.tsx` | Solde/plafond exacts et qualifications |
| `frontend/tests/search.test.tsx` | Assertions adaptées et cas d’intégration supplémentaires |
| `README.md` | Description des quatre indicateurs et du solde numérique |
| `docs/architecture.md` | Décision de composition et invariants, lisible dans Obsidian |
| `docs/validation.md` | Résultats et réserves de cette phase |
| `docs/codex-reports/phase-06.2.md` | Plan conservé et présent bilan |

Aucun backend, API, contrat de validation, module de tri, filtre, consentement, compteur, stockage de quota, handler de pagination, jeton, signature, lien légal, manifeste de dépendances ou fichier Compose modifié. Aucun nouveau composant ou effet réseau. Aucun commit, volume supprimé, accès OVH ou déploiement.

## Tests et contrôles réellement exécutés

Environnement : Debian ARM64 ; Node 24.22.2 préparé temporairement dans `/tmp`, archive vérifiée par SHA-256 contre le manifeste officiel ; dépendances projet existantes. Aucun service existant lancé ou modifié. Types et builds exécutés dans une copie isolée des fichiers frontend, avec dépendances locales et configuration identique ; pas de modification du cache du serveur applicatif.

| Contrôle | Résultat réel |
| --- | --- |
| `npm test` avant modification, depuis `frontend/` | **97 tests réussis, 7 fichiers**, 4,24 s |
| Premier passage après adaptation | **100 réussis, 6 échecs** sur la recherche par nom de rôle `term` dans les tests ; corrigé par association explicite des définitions aux libellés |
| Passage suivant | **106 tests réussis, 7 fichiers**, 3,57 s |
| Suite finale `npm test`, depuis `frontend/` | **110 tests réussis, 7 fichiers**, 4,68 s |
| `npm run typecheck` dans la copie finale | **Réussi** : génération des types de routes et `tsc --noEmit` |
| `NEXT_TELEMETRY_DISABLED=1 npm run build`, référence puis version finale | **Turbopack réussi après relance dans les deux copies**, code 0, cinq pages statiques générées ; avertissement de sécurité détaillé ci-dessous |
| Mesures Chromium avant/après | **Quatre comparaisons réussies**, mêmes navigateur/scénarios/viewports |
| Recette Chromium finale | **22 cas réussis**, zéro requête non simulée ou destination inattendue, zéro erreur JavaScript de page |

La suite finale conserve les scénarios préexistants de filtres/précision, consentement, dates, tri, déduplication, pagination manuelle/deux pages, critères soumis, jetons/signatures, doubles actions, erreurs et focus. Aucun test backend relancé : aucune modification backend. Aucune recherche YouTube réelle ou clé utilisée.

### Build et problèmes de préparation

1. La copie initiale des dépendances avait déréférencé les liens `.bin` : `Cannot find module '../server/require-hook'`. Liens rétablis, puis copie des dépendances refaite en conservant tous les liens symboliques.
2. Première copie située sous `frontend/node_modules/.cache` : erreur Turbopack `Failed to write app endpoint /page`, causée par `Expected process result to be a module, but it could not be processed` ; essai ponctuel Webpack également en échec (`Build failed because of webpack errors`, sans diagnostic supplémentaire). Ces essais n’ont pas produit les rendus comparés.
3. Tentative de déplacement de cette copie dans `/tmp` interrompue par `No space left on device`. Copie temporaire récupérée dans le workspace, dépendances recopiées proprement depuis l’original, espace temporaire libéré. Les copies de build ont ensuite été placées hors de `node_modules` (`.phase62-before` et `.phase62-after`), sans changer de configuration projet. Les deux rendus mesurés proviennent bien de builds **Turbopack**.
4. Après compilation, types et génération réussis, chaque copie a d’abord renvoyé un code 1 avec `SecurityFatalError: Your version of Next.js is affected by a known security vulnerability.` Une relance de la même commande a terminé avec code 0 et le rappel `This command is continuing after the upgrade reminder.` L’avertissement de l’outil est consigné, sans expertise de vulnérabilité ni mise à jour de dépendance dans cette phase ; un build réussi ne l’efface pas.
5. Playwright 1.65.0 préparé dans `/tmp` uniquement. Le registre npm a d’abord échoué avec `EAI_AGAIN` en sandbox ; installation temporaire réussie après autorisation. Aucun manifeste ou lockfile projet modifié. Aucun navigateur téléchargé : Chromium et les bibliothèques temporaires de phase 6.1 ont été réutilisés.
6. Lancement Chromium en sandbox bloqué : `FATAL:content/browser/sandbox_host_linux.cc:41 ... shutdown: Operation not permitted (1)`. Mesures et recette effectuées après autorisation hors sandbox, avec interception de toutes les requêtes.
7. Premier passage de recette arrêté sur un sélecteur Playwright par nom de rôle `definition` : Chromium expose le contenu natif `dt`/`dd` mais ce sélecteur ne trouvait pas la définition nommée. Ciblage du script corrigé par libellé `dt` puis `dd` associé ; aucun changement applicatif nécessaire. Le passage final complet a réussi. Cela ne remplace pas une écoute avec lecteur d’écran.

## Mesures UX avant/après réellement obtenues

Mesures prises avec **Playwright 1.65.0 / Chromium Headless Shell 158.0.8127.18**, même exécutable, même navigateur, même police Arial, zoom 100 %, mêmes assets et fixtures. Référence mesurée avant toute modification applicative. Builds de production Turbopack des deux versions, sans serveur Next actif : HTML et assets servis par interception depuis les builds sur `https://youfinder.test`. Les réponses `/api/videos/search` sont simulées ; toutes les autres destinations externes sont bloquées. Aucun proxy ou backend réel testé.

Fixture commune : mot-clé `python`, consentement coché, filtres fermés et vides, notice « Recherche non exhaustive. ». Page 1 : une carte simulée, examinées 5, retenues 1, écartées 4, omissions 0, solde 19/20 et continuation disponible. Page 2 : deux éléments dont le doublon de page 1, examinées 4, retenues 2, écartées 2, omissions 0, solde 18/20, fin de pagination. Après fusion : examinées 9, retenues 3, écartées 6, **2 cartes uniques**. Le script attend le rendu stabilisé et les polices, puis remet le scroll à zéro avant chaque mesure.

Hauteur statistique avant : haut de `SearchSummary` jusqu’au bas de `DailyAttempts`, espace intermédiaire inclus ; après : rectangle du panneau unique. Y carte : position documentaire du premier `article`, `getBoundingClientRect().top + scrollY`, sans arrondi des fractions. Les gains ci-dessous portent uniquement sur la présentation.

| Scénario | Viewport CSS | Hauteur statistiques avant → après | Y première carte avant → après | Carte remontée de |
| --- | --- | --- | --- | --- |
| Une page avec continuation | 375 × 900 | 1347 → 526 px | 2940,203125 → 2005,203125 px | 935 px |
| Deux pages avec doublon | 375 × 900 | 1301 → 526 px | 2730,203125 → 1849,203125 px | 881 px |
| Une page avec continuation | 1440 × 900 | 771 → 314 px | 1916,203125 → 1377,203125 px | 539 px |
| Deux pages avec doublon | 1440 × 900 | 771 → 314 px | 1816,203125 → 1285,203125 px | 531 px |

| Scénario | Viewport | Hauteur groupe organisation avant → après | Distance synthèse → carte avant → après |
| --- | --- | --- | --- |
| Une page | 375 × 900 | 726 → 612 px | 2113 → 1178 px |
| Deux pages | 375 × 900 | 562 → 456 px | 1903 → 1022 px |
| Une page | 1440 × 900 | 482 → 400 px | 1293 → 754 px |
| Deux pages | 1440 × 900 | 382 → 308 px | 1193 → 662 px |

Dans les quatre comparaisons : **3 → 1 panneaux visuels** entre début de synthèse et première carte (deux statistiques et organisation auparavant, un statistique ensuite). À scroll zéro, **1 → 1 de ces panneaux intersecte le viewport initial** ; ne pas confondre ce comptage avec le total du parcours ni inclure formulaire et cartes vidéo. Aucun débordement horizontal avant ou après (`scrollWidth <= innerWidth`).

Après : deux colonnes de 146,5 px à 375 px, quatre colonnes de 219,5 px à 1440 px. Captures mobile et desktop inspectées : nombres et libellés lisibles, sans troncature. La première carte reste sous le pli initial : aucune promesse de résultats entièrement visibles sans défilement sur mobile.

Artefacts temporaires conservés, ignorés par Git : `frontend/node_modules/.cache/phase62-evidence/` contient `before.json`, `after.json`, `recipe.json`, les huit captures `before/after-{375,1440}-{one,two}.png` et les scripts exécutés `phase62.cjs`, `phase62-recipe.cjs`. Les copies de build ont été rangées sous `frontend/node_modules/.cache/phase62-before` et `phase62-after` après les vérifications ; les scripts exécutés conservent les chemins de travail initiaux `.phase62-before`/`.phase62-after`, à restaurer pour les rejouer. Ces artefacts locaux ne constituent pas des fichiers source à livrer.

## Recette navigateur effectuée et limites

Les 22 cas finaux sont : dix cas à 375 px et les mêmes dix à 1440 px, plus deux contrôles de reflow à 320 et 768 px.

- Erreur réseau de continuation, conservation du solde 19 et des résultats, avertissement périmé, reprise manuelle en attente puis succès à 17, sans décrémentation locale ; mêmes paramètres de reprise et critère `python` initial malgré modification du champ.
- Doublon entre pages : trois retenues cumulées, deux cartes uniques ; tri local sans nouvel appel.
- Focus restauré vers le repère après disparition du bouton, Tab vers le tri, Maj+Tab vers la recherche. Autre cas : l’utilisateur rejoint le tri pendant l’attente, son focus y reste après succès. Contrôle du sélecteur par touche fléchée.
- Zéro examiné sans barre, tout filtré avec continuation disponible, omissions positives, solde restant nul, plafond nul, grand entier sûr `9007199254740991` intégralement visible sans débordement.
- Erreur de plafond quotidien : alerte et résultats conservés, solde marqué périmé, continuation bloquée.
- Erreur initiale : solde inconnu, aucune synthèse fabriquée ; retrait du consentement bloquant la recherche.
- Destinations et attributs `target`/`rel` des liens de consentement inchangés ; pages locales Confidentialité et Conditions réellement ouvertes dans des onglets, titre principal visible et aucun débordement. Aucun lien YouTube suivi.
- Reflow avec grand solde exact à 320 et 768 px, sans débordement. Aucun appel non simulé, aucune destination inattendue et aucune erreur JavaScript de page lors du passage final.

**Limites :** pas de Compose, de serveur/proxy réel ni de backend dans cette recette ; aucune consommation réelle de quota. Pas de mobile physique, Safari, lecteur d’écran, zoom navigateur natif 200 % ou bfcache validé. Les parcours clavier cités ne constituent pas une validation exhaustive de toutes les touches et technologies d’assistance. Contrastes non mesurés systématiquement ; palette existante conservée. Les états inconnus/incohérents de `DailyAttempts` sont testés unitairement ; le contrat API actuel empêche ces valeurs dans une réponse acceptée. La perte historique de résultats au retour des pages légales reste hors périmètre.

## Recette utilisateur restante et statut final

**Implémentation réalisée ; tests frontend, types, build Turbopack, mesures et recette Chromium simulée réussis. Recette utilisateur de phase 6.2 en attente.**

À vérifier dans l’environnement habituel : confort du panneau unique sur mobile/desktop, lisibilité des quatre indicateurs, compréhension retenues/uniques/écartées/omises, nombre de pages unique, erreurs et solde périmé, zéro et plafond nul, continuation et focus, tri et critères inchangés. Confirmer les tests/types/build dans Compose, mobile réel, Safari, zoom natif 200 %, parcours clavier complet et lecteur d’écran disponible. Aucun de ces contrôles restants n’est déclaré validé au nom de l’utilisateur.

L’avertissement de sécurité émis par Next.js reste une réserve indépendante à examiner dans un travail autorisé distinct ; aucune mise à jour de dépendance n’a été entreprise.


Contrôles finaux : `git diff --check` réussi ; rapport non suivi vérifié séparément avec `git diff --no-index --check /dev/null docs/codex-reports/phase-06.2.md` (code 1 attendu pour un fichier nouveau, aucun diagnostic de whitespace). Comparaison directe : états, handlers et effets de `VideoSearch` identiques à HEAD ; tous les fichiers finaux `src/` et `tests/` identiques à la copie utilisée pour types/build/recette. Copies et scripts temporaires rangés dans le cache ignoré ; aucun fichier de validation à livrer. Branche finale `feat/ui-compact-summary`, seuls les onze fichiers listés dans ce bilan apparaissent dans l’état Git.


## Clôture documentaire de la phase 6.2 — 16 novembre 2026

**Statut : recette utilisateur terminée et phase 6.2 clôturée, avec réserves maintenues.** L’utilisateur confirme le fonctionnement du panneau compact, des quatre indicateurs, de la pagination et du tri. Le plan initial, les bilans, les incidents et les mesures sont conservés ; les mentions précédentes de validation ou de recette en attente décrivent leur état historique.

### Origine et portée des validations

| Origine | Résultats attestés pour la phase 6.2 |
| --- | --- |
| Codex, lors de l’implémentation | 97 tests frontend avant modification, 110 tests finaux dans 7 fichiers, typecheck et build Turbopack réussis après relance, quatre mesures comparatives et 22 cas Chromium simulés ; environnements et limites conservés ci-dessus |
| Utilisateur, lors de cette clôture | Recette terminée ; fonctionnement du panneau compact, des quatre indicateurs, de la pagination et du tri confirmé |
| Docker / Compose, côté utilisateur | Aucun résultat de tests automatisés, de typecheck ou de build Docker de phase 6.2 explicitement confirmé dans ce retour ; ne pas en déduire une exécution réussie |

La confirmation Docker de phase 6.1 reste un résultat historique de cette phase et ne valide pas les tests Docker de phase 6.2. Aucun détail supplémentaire de scénarios, appareil, navigateur, commande ou sortie n’est fourni pour cette clôture. Aucun test automatisé, build, navigateur ou recherche YouTube n’a été relancé par Codex pour cette mise à jour documentaire.

### Problèmes ouverts et réserves conservées

- **Avertissement de sécurité Next.js : problème ouvert.** Le message `SecurityFatalError: Your version of Next.js is affected by a known security vulnerability.` et le rappel après relance restent consignés. Le build réussi et la recette utilisateur ne constituent ni une expertise ni une correction ; aucune dépendance mise à jour.
- Mobile physique, Safari, lecteur d’écran, zoom navigateur natif 200 %, bfcache, parcours clavier exhaustif et mesure systématique des contrastes : non validés par ce retour. Les contrôles Chromium simulés et leurs limites restent distincts.
- Tests/types/build dans Compose et fonctionnement du serveur/proxy/backend réels : pas de confirmation spécifique nouvelle. Les mesures Codex proviennent de builds servis par interception avec API simulée.
- Les cas limites non individuellement attestés par l’utilisateur (notamment solde inconnu ou périmé, erreurs, plafond nul et omissions) conservent uniquement les preuves Codex déjà documentées.
- La perte historique des résultats au retour des pages légales reste une limitation hors périmètre ; aucune persistance ajoutée.

### Périmètre de cette clôture

Seuls `docs/codex-reports/phase-06.2.md` et `docs/validation.md` sont complétés. Les modifications préexistantes du workspace sont conservées. Aucun code applicatif modifié, commit créé, service changé, volume supprimé, recherche YouTube lancée, accès ou déploiement OVH effectué pour cette clôture.
