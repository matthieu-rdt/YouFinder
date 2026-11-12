# Phase 6.1 — Accueil compact et filtres repliables

Date : 2026-11-12. Branche vérifiée : `feat/ui-compact-search`. Workspace propre au début de l’audit.

**Statut : audit et plan initial proposés, en attente de validation avant implémentation.** Seul ce rapport est créé. Il conservera le plan initial puis accueillera les décisions validées, le bilan réel, les tests, les problèmes et la recette utilisateur.

## Audit de l’existant

Lecture de `AGENTS.md`, du formulaire, de l’accueil, des styles, du composant de plafond, du contrat frontend, des pages légales, des tests de recherche et d’accueil, ainsi que des passages pertinents du README et des documents d’architecture/API. Audit statique : aucun rendu navigateur ni capture actuelle inspecté pendant cette intervention. Les captures mentionnées dans la demande ne sont pas une nouvelle vérification réalisée ici.

- `frontend/src/app/page.tsx` empile un bandeau « Projet personnel », le titre, une introduction et un encadré de limites avant le formulaire. Les liens du footer comprennent YouTube, les pages légales et le health check.
- `frontend/src/components/video-search.tsx` ajoute le logo officiel, un titre de formulaire, le mot-clé et son aide, puis un fieldset toujours visible de cinq champs : deux bornes de date et trois seuils numériques. Plusieurs aides longues, le consentement et le coût par page contribuent à la hauteur initiale.
- Les champs sont actuellement non contrôlés et lus par `FormData`. Ils restent montés lors des recherches : leurs valeurs sont déjà conservées sur la même page, y compris après une réponse vide ou une erreur. Ne pas introduire de remise à zéro ni de changement de clé React.
- La recherche soumise est mémorisée dans `criteria.current`. La continuation utilise cet instantané, indépendamment des modifications ultérieures des champs. `load`, `loadNext`, les cumuls, la déduplication et le tri ne nécessitent pas de refonte.
- Le navigateur applique `required`, `min`, `step` et `maxLength`. Le gestionnaire vérifie aussi mot-clé, ordre des dates, borne de fin UTC et écriture décimale des seuils. Une validation native peut empêcher `submit` : traiter uniquement les erreurs dans ce gestionnaire serait insuffisant pour des filtres repliés.
- `globals.css` prévoit déjà un focus visible sur `summary`, des champs de 48 px et une grille adaptative. Les éventuels nouveaux styles devront rester ciblés pour préserver les pages légales.
- Les tests de recherche couvrent consentement, dates UTC, grands entiers, seuil zéro, erreurs, doubles soumissions, conservation de valeurs, deux pages, critères de continuation, compteurs, tris et focus de pagination. Plusieurs soumettent directement avec `fireEvent.submit` ; cela ne prouve pas la validation et la navigation natives du navigateur.
- Le test d’accueil attend actuellement les longs textes de limites visibles ; le test de groupement attend un fieldset accessible dès le montage. Il faudra adapter ces attentes à la nouvelle présentation sans retirer leurs garanties.

Référence historique de phase 6 : 88 tests frontend, typecheck et build Turbopack Next.js 16.4.3 réussis dans Docker Compose, confirmés par l’utilisateur. **Aucun de ces contrôles n’a été relancé pour ce plan.** Le mobile réel et la recette clavier détaillée restent non validés ; la perte des résultats après navigation légale reste une limitation observée, sans attribution démontrée à la phase 6.

## Objectif et périmètre

Réduire nettement la hauteur avant les résultats tout en conservant recherche, critères, consentement, attribution et informations utiles. Aucun backend, contrat HTTP, règle métier, quota, tri, pagination, Compose ou OVH modifié. Aucun appel YouTube automatique ou réel pour cette phase. Aucune nouvelle dépendance prévue.

La conservation demandée porte sur les nouvelles recherches dans la même page montée. La persistance après rechargement, fermeture ou navigation vers une autre page est hors périmètre : aucun stockage navigateur ni synchronisation d’URL. L’étude de conservation d’état après navigation légale reste une phase future distincte.

## Structure visuelle minimale proposée

Ordre de lecture et de tabulation :

1. En-tête compact : titre `YouFinder` sobre et attribution officielle YouTube conservée, lien et proportions de l’image préservés ; pas de bandeau « Projet personnel » ni de grand encadré introductif.
2. Mot-clé avec label visible et aide courte sur la limite de 200 caractères. Conserver un nom accessible pour le formulaire sans imposer un grand titre supplémentaire.
3. Ligne `Filtres avancés — aucun filtre actif` ou `Filtres avancés — N filtres actifs`, avec indicateur natif de dépliage. Le contenu est fermé au premier montage.
4. Consentement explicite inchangé, non précoché, avec liens Confidentialité, Conditions et conditions YouTube toujours visibles et mêmes destinations/comportements.
5. Bouton `Rechercher sur YouTube`, toujours hors des filtres ; désactivation pendant chargement et sans consentement inchangée. Une ligne courte conserve le coût : une tentative par page, même en cas d’erreur Google, et absence d’appel automatique.
6. Note compacte toujours visible : deux pages manuelles de 50 identifiants maximum et recherche non exhaustive. L’explication du tri local reste dans la zone de tri où elle est utile.
7. États et résultats existants. Avant toute réponse, remplacer le grand panneau d’invitation et le panneau de solde inconnu par une seule note compacte : solde interne inconnu avant réponse, distinct du quota Google. Après réponse, garder `SearchSummary` et `DailyAttempts` et leurs états actuels.
8. Footer conservé, avec liens légaux, attribution et health check.

Dans les filtres ouverts : conserver fieldset/legend et labels, deux dates puis trois seuils, une colonne sur petit écran et grille adaptée au-delà. Les aides UTC, abonnés arrondis, données indisponibles, combinaison ET et exclusion des directs restent lisibles à proximité des champs concernés. La compacité ne repose pas sur une réduction excessive des caractères ou des cibles tactiles. Aucun texte légal requis ni logo officiel ne sera masqué pour gagner de la place.

Mesurer avant/après, avec mêmes viewport et zoom, la hauteur de l’en-tête et du formulaire ainsi que la position du début des résultats simulés. Présenter les valeurs réellement obtenues ; pas de promesse de tout faire tenir dans un écran mobile avec les filtres ouverts.

## Choix de composant et gestion des valeurs

**Choix proposé : un unique `details` natif dont le premier enfant est `summary`, contenant le fieldset existant.** Pas d’accordéon générique, de rôle bouton ajouté ou de gestion clavier personnalisée tant que le comportement natif satisfait la recette. Aucun lien ou autre contrôle interactif imbriqué dans le summary.

Les champs restent montés et activés quand le panneau est fermé : pas de rendu conditionnel, de `disabled`, de copie des valeurs ou de suppression des paramètres. Garder les noms et la sérialisation existants. L’ouverture/fermeture ne soumet rien, ne modifie pas les résultats et ne déclenche aucun `fetch`.

Utiliser une référence au `details` pour la réouverture sur erreur. Éviter un état React d’ouverture redondant ; le compteur peut être affiché dans le summary dans les deux états, ce qui garantit sa présence à la fermeture sans synchronisation supplémentaire. Les comportements natifs d’ouverture, de focus et de validation seront vérifiés dans les navigateurs ciblés avant de conclure.

### Définition du nombre de filtres actifs

- Compter les **champs avancés renseignés**, entre 0 et 5, et non le nombre de groupes : début seul = 1, fin seule = 1, deux bornes = 2, chacun des trois seuils = 1.
- Mot-clé et consentement exclus. Chaîne vide = inactif ; chaîne `0` = actif. Aucun test de vérité numérique ni conversion `Number` pour compter ou transmettre, afin de préserver les grands entiers.
- Une valeur renseignée mais invalide reste comptée tant qu’elle est présente ; le compteur décrit les critères saisis, pas leur validité ni les critères des résultats déjà affichés. Ajouter une aide courte précisant que les modifications s’appliquent à la prochaine recherche.
- Recalculer le nombre à partir des cinq champs sur leurs événements de saisie/changement ; un seul petit état de présentation, sans rendre tout le formulaire contrôlé. Prévoir l’initialisation à partir du DOM pour une éventuelle restauration du navigateur, et vérifier cette limite en recette.
- Pour les saisies numériques intermédiaires dont le navigateur expose une valeur vide et `badInput`, ne pas inventer de valeur : l’erreur de validité reste bloquante, indépendamment du compteur.
- Vérifier singulier/pluriel, suppression d’un champ, retour à zéro, fermeture/réouverture et conservation après résultat, erreur et nouvelle recherche. Ne pas annoncer chaque frappe dans une région live.

## Champ invalide dans les filtres repliés

Conserver la validation native et les gardes applicatives ; ne pas ajouter `noValidate` ni assouplir les contraintes existantes.

1. Intercepter les événements `invalid` au niveau du formulaire en phase de capture. Si la cible appartient au fieldset replié, ouvrir le `details` avant de tenter de focaliser le champ. Garder une référence au premier champ invalide pour éviter que plusieurs événements déplacent successivement le focus.
2. Laisser la soumission bloquée, sans appel réseau, avec explication visible et accessible. Vérifier en navigateur si l’ouverture synchrone permet la présentation native ; si nécessaire, gérer la focalisation après ouverture/rendu sans boucle de `reportValidity` ni double message. Le mécanisme final et ses limites seront consignés dans le bilan.
3. Pour les erreurs applicatives qui échappent aux contraintes natives, notamment dates inversées ou borne de fin non sérialisable : ouvrir les filtres et focaliser le premier champ concerné, avec message associé. Pour un mot-clé invalide, focaliser le mot-clé sans ouvrir inutilement les filtres.
4. Une erreur locale ne vide ni champs ni résultats, ne consomme pas de tentative et ne périme pas le solde. Après correction, l’utilisateur soumet explicitement ; aucune relance automatique. Ne pas modifier le traitement existant des erreurs API.
5. Fermer volontairement les filtres laisse le focus sur le summary ; les champs fermés ne doivent pas rester dans le parcours Tab. La disparition du bouton de pagination conserve le mécanisme de focus actuel.

## Fichiers concernés après validation

| Fichier | Modification prévue |
| --- | --- |
| `frontend/src/app/page.tsx` | En-tête compact, suppression des paragraphes introductifs redondants, maintien du footer |
| `frontend/src/components/video-search.tsx` | Disclosure natif, compteur, réouverture sur erreur, textes et état initial compacts ; orchestration réseau préservée |
| `frontend/src/app/globals.css` | Seulement si nécessaire : styles ciblés du summary, marqueur et espacements ; focus et cibles conservés |
| `frontend/tests/search.test.tsx` | Interactions, compteur, paramètres masqués, erreurs, consentement et non-régression |
| `frontend/tests/page.test.tsx` | Nouvelle structure compacte, limites courtes et liens conservés, absence d’appel au montage/remontage |
| `README.md`, `docs/architecture.md`, `docs/validation.md` | Mode d’emploi, décision de disclosure, résultats réellement exécutés et réserves ; liens compatibles Obsidian |
| `docs/codex-reports/phase-06.1.md` | Plan initial conservé, décisions et bilan ajoutés dans ce même fichier |

Pas de modification prévue de `DailyAttempts`, des cartes, du résumé, de `youtube.ts` ou `video-sort.ts`. Le panneau de solde initial est compacté au point d’appel ; le composant de solde après réponse reste inchangé. Pas d’extraction de composant ou d’utilitaire générique nécessaire à ce stade.

## Tests et recette à prévoir après validation

### Tests automatisés avec les outils existants

Établir une référence frontend avant modification, puis exécuter toute la suite finale. Utiliser exclusivement `fetch` simulé. Adapter les tests qui cherchent des champs avancés pour ouvrir explicitement la section ; conserver les assertions de paramètres, précision, appels et résultats.

| Scénario | Attendu |
| --- | --- |
| Premier montage/remontage | Filtres fermés, compteur nul, consentement non coché, aucun appel automatique |
| Ouverture et fermeture répétées | Valeurs et résultats inchangés, aucun appel ni soumission |
| Compteur | Cas de 0 à 5, chaque date, zéro, grand entier, effacement, valeur invalide renseignée et grammaire |
| Recherche panneau fermé | Les cinq critères sont envoyés comme auparavant, UTC inclusif et grands entiers préservés ; champs vides omis |
| Nouvelle recherche sur la même page | Mot-clé, filtres et consentement conservés ; nouvelle requête avec les valeurs actuelles, pas de remise à zéro du formulaire |
| Résultat vide ou erreur API/réseau | Critères conservés, aucun retry ; comportements de solde et résultats existants préservés |
| Invalidité native | Événement invalid sur champ replié : ouverture, premier champ ciblé, aucun appel ; compléter impérativement en navigateur |
| Invalidité applicative | Dates inversées, fin non sérialisable et seuil invalide : erreur visible, ouverture/focus appropriés, aucune tentative |
| Consentement | Bouton et gardes inchangés ; liens et conditions YouTube visibles, retrait du consentement bloque aussi la continuation |
| Pagination et tri | Deux pages au maximum, critères soumis inchangés après édition/repli, mêmes tris, cumuls, déduplication et restauration du focus |
| Accueil et mentions | Titre, attribution, limites, coût et liens présents ; informations déplacées testées à leur emplacement pertinent |

Les événements synthétiques Vitest/jsdom ne prouvent pas l’activation clavier native de `summary`, la présentation des erreurs natives ou le reflow. Ne pas simuler un succès navigateur par une simple modification de l’attribut `open`.

Après changements finaux : tests frontend, `npm run typecheck`, build Turbopack avec télémétrie désactivée, de préférence dans l’environnement Docker Compose habituel et un conteneur temporaire pour isoler le cache du serveur actif, sans modification de Compose ni suppression de volume. Consigner commande, environnement, résultat et éventuel blocage ; aucun nombre de tests présumé. `git diff --check` pour la forme. Pas de nouvelle suite backend nécessaire à cette présentation frontend.

### Recette navigateur, clavier et responsive

- Avec réponses simulées : 320/375 px, tablette et desktop ; aucun débordement, summary/compteur lisibles, grands nombres, boutons et consentement accessibles, filtres ouverts et fermés. Mesurer le gain de hauteur et vérifier zoom à 200 %.
- Tab et Maj+Tab : mot-clé, summary, champs uniquement si ouverts, consentement, liens et recherche. Entrée/Espace sur le summary : bascule sans soumission ; focus visible et stable, aucun piège.
- Clic du bouton et Entrée depuis le mot-clé avec un seuil négatif/fractionnaire masqué ; dates inversées masquées ; plusieurs erreurs : ouverture et focus sur le premier champ pertinent, aucune requête. Corriger puis soumettre explicitement.
- Fermer après saisie valide, soumettre, vérifier paramètres et compteur ; relancer une recherche sur la même page. Éditer ensuite les critères sans soumettre et confirmer que la continuation conserve l’instantané initial.
- Vérifier les pages légales après les styles, les liens du consentement, les annonces de chargement/erreur et le focus après disparition du bouton de pagination.
- Vérifier dans les navigateurs habituels, notamment Safari/macOS, puis sur appareil mobile réel si disponible. Avec lecteur d’écran disponible : summary, état ouvert/fermé, compteur, labels et erreurs. Documenter tout contrôle indisponible comme non effectué ; ne pas déclarer les réserves héritées de phase 6 levées sans preuve.

## Découpage proposé et critères de clôture

1. Après validation explicite de ce plan : mesurer la référence visuelle simulée et exécuter les tests de référence.
2. Compacter l’accueil et l’état initial, intégrer `details/summary` et le compteur sans changer les paramètres ni les gardes réseau.
3. Traiter invalidité native et applicative des champs repliés ; adapter et compléter les tests ciblés.
4. Exécuter suite finale, types, build et recette navigateur disponible ; documenter les limites techniques et les contrôles utilisateur restants.
5. Actualiser les documents concernés et compléter ce même rapport avec bilan, commandes/résultats réels et recette. Présenter le diff et attendre la recette/validation utilisateur. Aucun commit ou déploiement automatique.

Clôture attendue : hauteur initiale sensiblement réduite avec mesures comparables, filtres fermés au montage mais toujours appliqués, compteur exact et critères conservés sur la même page, validation masquée utilisable, consentement et informations nécessaires préservés, non-régression automatisée et limites de recette explicitement consignées.

## Risques et limites

Le principal risque est la validation native d’un champ non visible avant que le gestionnaire `submit` ne s’exécute. Le comportement doit être établi par un vrai parcours navigateur. Autres points : compteur désynchronisé d’une restauration de formulaire, ambiguïté entre critères édités et critères des résultats, perte d’accès aux aides, focus mobile et modification excessive des textes nécessaires. Limiter les nouveaux états et garder les données dans le formulaire réduit le périmètre.

Le compteur de champs renseignés est une information de formulaire, pas une nouvelle métrique YouTube. Le choix de compacter les explications ne constitue pas une nouvelle vérification juridique de conformité ; les mentions et destinations existantes sont conservées. Les réserves d’accessibilité et de navigation de phase 6 restent distinctes de cette proposition.

## Décisions validées, réalisation et tests de cette intervention

À ce stade, le périmètre autorisé est l’audit et la préparation de ce plan. La structure et les choix ci-dessus sont proposés, pas implémentés. Seul ce fichier a été créé ; aucun code applicatif ou autre document modifié. Aucun test, typecheck, build, navigateur ou recherche YouTube réelle lancé. Aucun commit, modification de service/Compose, intervention OVH ou déploiement.

Contrôles documentaires : `git diff --check` réussi ; vérification explicite du nouveau fichier non suivi avec `git diff --no-index --check /dev/null docs/codex-reports/phase-06.1.md`. Aucun résultat de test applicatif annoncé pour cette intervention.

## Recette utilisateur et statut

**Non commencée pour la phase 6.1 ; implémentation en attente de validation du présent plan.** La clôture acceptée avec réserves de phase 6 reste historique. Le bilan d’implémentation et les résultats réels seront ajoutés ici sans effacer le plan initial.


---

# Bilan d’implémentation — phase 6.1

Date : 2026-11-12. **Statut au bilan initial : plan et précisions explicitement validés, implémentation réalisée ; recette utilisateur restante.** Le plan initial ci-dessus est conservé sans réécriture. Ses mentions d’attente de validation décrivent l’état avant cette autorisation.

## Décisions validées et réalisation

L’utilisateur a autorisé un accueil nettement plus court, `details/summary` natif fermé au premier affichage, cinq champs maintenus montés/activés, compteur « Filtres avancés — N critères renseignés », réouverture fiable sur erreur, mesures avant/après et tests navigateur réels. Aucun élargissement du périmètre métier.

L’en-tête conserve YouFinder et le logo officiel YouTube inchangé. Le mot-clé, le consentement avec tous ses liens et le bouton restent hors des filtres. Les limites de deux pages/100 identifiants et le coût par page restent visibles en version courte. Le solde inconnu initial est une note ; après réponse, synthèse et jauge sont inchangées. Les styles existants suffisent : aucun changement CSS global ni réduction des tailles de champs.

Les cinq filtres non contrôlés restent dans le formulaire, y compris repliés. Un état de présentation compte chaque champ non vide sans conversion numérique ; zéro et les grands entiers comptent. Le compteur reste dans le summary dans les deux états, avec singulier/pluriel adapté. Il est réconcilié à la saisie, au montage et sur `pageshow`. Le panneau garde son état pendant les recherches ; il est fermé lors d’un nouveau montage. Les valeurs sont conservées lors des nouvelles recherches de cette même page.

La capture de `invalid` conserve le blocage natif, ouvre les filtres et focalise le premier champ invalide. L’affichage natif de la bulle est remplacé par une alerte et les attributs `aria-invalid`/`aria-errormessage` ; les événements invalid suivants ne volent pas le focus. Les validations applicatives existantes passent par le même mécanisme. Les messages HTML peuvent suivre la langue du navigateur. Une erreur locale ne lance pas d’appel, ne vide pas les résultats et ne périme pas le solde. Aucun état React d’ouverture ni gestion clavier personnalisée ; le comportement natif a été testé dans Chromium.

Les fonctions réseau, instantané des critères de continuation, compteurs, déduplication, tri, quota et règles de filtrage restent identiques. Aucun stockage applicatif, effet réseau, backend, API, Compose ou nouvelle dépendance projet. La navigation légale conserve son comportement ; l’étude de persistance reste future.

## Fichiers réellement modifiés

| Fichier | Changement |
| --- | --- |
| `frontend/src/app/page.tsx` | En-tête compact et attribution déplacée, introductions redondantes retirées, footer conservé |
| `frontend/src/components/video-search.tsx` | Filtres natifs, compteur, validation/focus, informations compactes et note initiale |
| `frontend/tests/search.test.tsx` | Neuf tests ajoutés ; attente d’accessibilité du fieldset adaptée à l’ouverture |
| `frontend/tests/page.test.tsx` | Assertions de limites courtes et attribution ; garanties de montage conservées |
| `README.md` | Usage des filtres fermés, compteur et nouvelle recherche |
| `docs/architecture.md` | Décision native et validation, lisible dans Obsidian |
| `docs/validation.md` | Résultats, mesures, problèmes et limites réels |
| `docs/codex-reports/phase-06.1.md` | Présent bilan ajouté au plan initial conservé |

## Mesures de réduction de hauteur

Mesures en pixels CSS arrondis, Chromium Headless Shell 158.0.8127.18 / Playwright 1.65.0, même viewport et même scénario avant/après : mot-clé `python`, consentement coché, champs avancés vides, une vidéo simulée et une continuation disponible. Le rendu de référence provient d’une copie prise avant modification ; les deux versions sont mesurées avec le même script. Le dernier passage utilise deux builds Webpack pour éviter une différence de moteur entre versions.

« Avant formulaire » mesure la distance du haut de `main` au haut du formulaire, marges et attribution incluses. La hauteur du formulaire est son rectangle complet. « Début résultats » est la position verticale absolue du début de la synthèse, pas de la première carte. Avant recherche, cette synthèse n’existe pas ; le bas du formulaire initial est fourni séparément. Aucune réduction de taille globale ou de zoom n’est utilisée pour ces mesures.

| Viewport | Avant formulaire, avant → après | Formulaire, avant → après fermé / ouvert | Début résultats, avant → après fermé / ouvert | Gain résultats, fermé |
| --- | --- | --- | --- | --- |
| 320 × 900 | 600 → 163 | 1627 → 704 / 1727 | 2291 → 931 / 1954 | 1360 px (59.4 %) |
| 375 × 900 | 552 → 163 | 1447 → 600 / 1535 | 2063 → 827 / 1762 | 1236 px (59.9 %) |
| 768 × 900 | 452 → 123 | 899 → 470 / 943 | 1415 → 657 / 1130 | 758 px (53.6 %) |
| 1440 × 900 | 428 → 123 | 821 → 436 / 845 | 1313 → 623 / 1032 | 690 px (52.6 %) |

Bas du formulaire au premier affichage, avant → après fermé : **2227 → 867 px** (320), **1999 → 763 px** (375), **1351 → 593 px** (768), **1249 → 559 px** (1440). Les filtres étaient toujours visibles dans la version antérieure : il n’existe pas d’état fermé historique à mesurer. Le formulaire ouvert est légèrement plus haut qu’avant (summary et indication ajoutés), mais le début global des résultats reste remonté grâce à l’en-tête compact. À 320 px, le panneau ouvert reste naturellement long ; il n’est pas présenté comme tenant dans un écran.

Aucun débordement horizontal aux quatre largeurs, avant/après recherche et après ouverture. Zoom CSS de 200 % à 1440 px vérifié ouvert/fermé sans débordement ; ce contrôle de reflow ne remplace pas une recette avec zoom natif du navigateur.

## Tests réellement exécutés et résultats

- Référence frontend : **88 tests réussis dans 7 fichiers**. Suite adaptée intermédiaire : **88 réussis** ; premiers ajouts : **95 réussis** ; suite finale : **97 réussis dans 7 fichiers**. Les neuf nouveaux tests détaillés dans [[../validation]] couvrent les comportements ajoutés sans supprimer les garanties antérieures.
- Typecheck final : **réussi** (`npm run typecheck`, génération des types de routes puis TypeScript), sources et tests finaux dans une copie isolée.
- Build de référence Webpack : **réussi**. Premier Turbopack isolé avec dépendances locales : **réussi**, Next.js 16.4.3 et cinq pages statiques. Build Turbopack final : **bloqué sur l’ouverture d’un port local pendant le traitement CSS**, en sandbox puis après autorisation ; aucun diagnostic de défaut applicatif déduit.
- Build final `NEXT_TELEMETRY_DISABLED=1 npm run build -- --webpack` : **réussi**, compilation, types et cinq pages statiques. Aucun changement de configuration pour ce repli.
- Contrôle Chromium sur build final avec API simulée : **réussi**, mesures ci-dessus, aucune erreur JavaScript de page. Détail des parcours :

- Filtres fermés au montage ; Tab/Maj+Tab, Entrée/Espace sur le summary natif ; champs fermés exclus de la tabulation, pas de soumission au dépliage.
- Seuil négatif et fractionnaire replié, par clic et Entrée depuis le mot-clé, avec deux erreurs simultanées : ouverture, premier champ visible et focalisé, message affiché, zéro appel API.
- Dates inversées et fin `9999-12-31` non sérialisable repliées : validation applicative, ouverture et focus, valeurs conservées, zéro appel API.
- Cinq critères repliés transmis, zéro actif, entier `9007199254740993` intact, fin inclusive UTC au lendemain ; nouvelle recherche sans perte de valeurs.
- Tri sans appel supplémentaire ; modification des critères puis continuation utilisant l’instantané soumis, limite à deux pages, doublon dédupliqué et focus du bouton disparu restauré vers le résumé.
- Retrait du consentement : recherche désactivée ; destinations et comportement des liens légaux conservés.
- Navigation réelle vers Conditions puis retour historique Chromium : les cinq valeurs sont restaurées nativement, compteur à 5, panneau fermé. Cela vérifie la réconciliation après retour sans ajouter de stockage applicatif. Le bfcache est désactivé par défaut dans cette exécution Playwright ; ce mécanisme précis n’est pas validé.
- Pages légales sans débordement à 375 px. Aucune erreur JavaScript de page lors du passage final.

Environnement : Debian ARM64, Node 24.22.2 temporaire vérifié par SHA-256 officiel, dépendances existantes. Tests lancés avec Node dans le PATH depuis `frontend/` ; types/builds dans `.phase61-validation` avec copie locale des sources/tests/dépendances. Playwright 1.65.0 et Chromium Headless Shell 158.0.8127.18 préparés temporairement, sans dépendance projet ajoutée. HTML/assets interceptés sur un domaine fictif, API simulée et autres destinations bloquées : proxy et serveur réel non testés. Scripts et mesures temporaires dans `/tmp/youfinder-ui-tools/compact.cjs` et `/tmp/youfinder-compact-results.json`.

## Problèmes rencontrés et limitations

Docker refuse l’accès à son socket, y compris après autorisation ; aucune suite Compose exécutée. Première extraction Node avec une option Python non disponible, puis extraction tar réussie ; une commande npm lancée à la racine a échoué faute de `package.json`, les commandes suivantes ont ciblé le frontend. Premier Turbopack temporaire avec dépendances liées hors racine en échec de résolution Next, corrigé par copie locale des dépendances. Le premier build local réussi ne remplace pas le résultat final : après indentation du code et ajout des derniers tests, la nouvelle compilation CSS bloque sur `binding to a port: Operation not permitted (os error 1)`, même après autorisation. Webpack final réussit.

Chromium : premier téléchargement saturant `/tmp`, reprise dans un cache ignoré sur la partition du projet, restrictions DNS puis autorisation, bibliothèques Debian manquantes extraites temporairement sans installation système, lancement hors sandbox après restriction locale. Première recette arrêtée par un sélecteur d’alerte ambigu avec l’annonceur Next ; ciblage `#search-error` corrigé, recette finale complète réussie. Ces incidents ne sont pas des régressions applicatives démontrées. Détails et commandes de contrôle dans [[../validation]].

Les tailles simulées ne remplacent pas un appareil mobile réel. Safari, lecteur d’écran, bfcache et zoom navigateur natif n’ont pas été validés ici. Le zoom CSS à 200 % est un contrôle complémentaire de reflow seulement. Les valeurs restaurées par le navigateur lors du retour historique ont été observées et comptées correctement ; aucune persistance de résultats n’a été introduite.

## Recette utilisateur restante et statut au bilan initial

**En attente de recette utilisateur de phase 6.1.** Vérifier sur l’environnement habituel : confort et hauteur, filtres fermés/ouverts et valeurs conservées, compteur (dont zéro), recherche avec filtres masqués, négatif/fraction et dates inversées repliés, correction puis soumission explicite, nouvelle recherche, consentement, deux pages et tris. Confirmer tests/types/build Turbopack final dans Compose, Safari/macOS, mobile réel, zoom natif 200 %, parcours Tab/Maj+Tab/Entrée/Espace, focus de pagination et lecteur d’écran disponible.

La phase 6 reste clôturée avec ses réserves ; cette implémentation ne les lève pas au nom de l’utilisateur. La perte des résultats au retour des pages légales n’est pas corrigée ni attribuée à la phase 6. Aucun appel YouTube réel, secret exposé, changement backend/API/Compose/quota, volume supprimé, commit, accès ou déploiement OVH.

Contrôles finaux : `git diff --check` réussi ; nouveau rapport non suivi vérifié explicitement par `git diff --no-index --check /dev/null docs/codex-reports/phase-06.1.md`, sans erreur de whitespace (code 1 attendu pour un contenu différent). Copies et bibliothèques de validation déplacées après les vérifications dans le cache ignoré `frontend/node_modules/.cache/phase61-*` ; aucun fichier de validation temporaire à livrer.


## Clôture documentaire de la phase 6.1 — 2026-11-12

**Statut : recette utilisateur de phase 6.1 clôturée sur la base des 14 scénarios validés par l’utilisateur, avec maintien des réserves non testées.** Le plan initial, le bilan d’implémentation, les mesures UX et les résultats historiques sont conservés. Les mentions antérieures de recette restante décrivent l’état avant ce retour utilisateur.

### Recette utilisateur confirmée

L’utilisateur déclare les **14 scénarios de recette validés**, y compris le compteur de critères renseignés avec la valeur numérique **0** : zéro compte comme un critère renseigné, contrairement à une chaîne vide. Le détail individuel des 14 scénarios n’est pas fourni dans ce retour ; aucune liste supplémentaire ni validation exhaustive n’est déduite.

Cette recette est un retour utilisateur, distinct des tests automatisés et des parcours Chromium précédemment exécutés par Codex. Elle ne lève pas les contrôles explicitement non testés ci-dessous.

### Tests automatisés et build Docker

- **Résultats historiques Codex conservés** : 97 tests frontend réussis dans 7 fichiers, typecheck réussi, build Webpack final réussi et contrôles Chromium avec réponses API simulées réussis, dans les environnements et avec les limites déjà consignés.
- **Build Turbopack réussi dans Docker, confirmé par l’utilisateur.** Codex n’a pas exécuté ce build ni vérifié directement sa sortie pour cette clôture. La commande précise, la durée et les détails de sortie ne sont pas fournis dans ce retour et ne sont pas reconstitués.
- Cette confirmation complète le blocage historique du build Turbopack final dans l’environnement Codex (`binding to a port: Operation not permitted`), sans l’effacer ni le qualifier d’erreur applicative. Le build est désormais consigné comme réussi dans Docker côté utilisateur.
- Ce retour ne confirme pas de nouvelle exécution des suites frontend ou du typecheck dans Docker, ni une validation en production. Aucun test automatisé, build, navigateur ou recherche YouTube n’a été relancé par Codex pour cette mise à jour documentaire.

### Réserves conservées et limites

**Mobile réel, Safari et lecteur d’écran : non testés, non validés.** Les contrôles sur des viewports simulés ne remplacent pas un appareil réel ni ces environnements.

Les autres limites existantes restent applicables : bfcache non vérifié, zoom CSS distinct du zoom navigateur natif, contrastes/états non échantillonnés et contrôles clavier/accessibilité détaillés non individuellement attestés par ce retour. La validation globale des 14 scénarios ne permet pas d’inventer une confirmation spécifique de ces contrôles. Les limites des vérifications Codex (Docker inaccessible, rendu servi par interception sans proxy ni backend réel) restent historiques et distinctes du build Docker confirmé par l’utilisateur.

La disparition des résultats au retour des pages légales reste une limitation observée, sans attribution démontrée à la phase 6. Aucune persistance ni correction n’est ajoutée ; l’étude de conservation de l’état de recherche reste prévue pour une phase future. Ces réserves ne sont pas présentées comme des régressions confirmées.

### Périmètre de la clôture

Seuls `docs/validation.md` et `docs/codex-reports/phase-06.1.md` sont mis à jour pour cette clôture. Aucun code applicatif modifié, commit créé, volume supprimé, déploiement ou intervention OVH effectué. Les modifications préexistantes du workspace sont préservées.
