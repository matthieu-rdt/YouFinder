# Phase 6.3 — Tableau analytique dense des résultats

17 novembre 2026 · Plan initial soumis à validation. La maquette 3 et le thème sombre sont validés. La structure HTML et le comportement mobile proposés ci-dessous restent à valider avant l’implémentation.

## 1. Audit du dépôt et de l’interface

- `AGENTS.md` lu. Branche active `feat/ui-video-list`, référence de départ `de4193694241d73492ac6c16439b78d440d64df6`. Arbre et index Git propres au début de l’audit. Les phases 6.1, 6.2 et SEC-01 figurent dans l’historique.
- `frontend/package.json` et `frontend/package-lock.json` fixent Next.js à **16.4.5**. Le manifeste de `frontend/node_modules/next` indique **16.4.3**. Node est absent du PATH de l’audit. Le rapport SEC-01 consigne une validation utilisateur antérieure du build Turbopack 16.4.5 dans un conteneur temporaire et des échecs Codex liés à l’ouverture d’un port. Aucune installation effectuée pendant cet audit.
- `video-card.tsx` affiche un `article` par vidéo. La miniature est un lien avec nom accessible et image décorative (`alt=""`). Le titre de niveau 3 est lié à la vidéo, la chaîne a un lien conditionnel et le lien « Voir sur YouTube ↗ » est décrit comme ouvrant un nouvel onglet. Les liens externes utilisent `target="_blank"` et `rel="noopener noreferrer"`. Une URL de miniature absente donne « Miniature indisponible ». Une URL présente dont le chargement échoue n’a pas de remplacement explicite dans le composant.
- `video-search.tsx` rend une liste ordonnée de cartes, sur deux colonnes à partir de `sm`. La région des résultats porte `aria-busy`. Un statut en direct signale la recherche, le chargement de la suite et la mise à jour. Les erreurs utilisent `role="alert"`. Les champs invalides sont reliés au message, avec ouverture des filtres si nécessaire et focus sur le champ fautif. L’état vide distingue l’absence de vidéo correspondant aux critères.
- `SearchSummary` et `DailyAttempts` affichent quatre indicateurs, les exclusions, les omissions éventuelles et le solde interne qualifié selon l’état de la requête. Le résumé de pagination, le bouton manuel et le sélecteur de tri précèdent les résultats. Après la seconde page, le focus du bouton disparu revient au résumé si l’utilisateur est resté sur le bouton. Un déplacement de focus pendant la requête est respecté.
- Le sélecteur appelle `sortVideos` sur les résultats cumulés et dédupliqués. Les trois modes actuels sont pertinence, date décroissante et date croissante. Les dates invalides ou absentes sont en fin des tris chronologiques et les égalités suivent l’ordre de première apparition. Le changement de tri est local. La continuation emploie l’instantané soumis et le couple jeton/signature, une seule fois avec succès.
- `globals.css` fournit le fond sombre, la police Arial, les bordures ardoise et le contour `focus-visible` bleu clair. La page limite actuellement le contenu avec `max-w-5xl` et fournit les liens d’attribution et les pages légales.
- `video.test.tsx` couvre les grands entiers, zéro, les valeurs absentes, les abonnés masqués et le direct. `search.test.tsx` contient notamment des assertions sur les cartes par rôle `article`, l’ordre des titres et le chargement de 100 vidéos. Il couvre aussi consentement, requêtes simulées, continuation, déduplication, erreurs, synthèse et focus. `video-sort.test.ts` vérifie la précision chronologique. Les suites `search-summary`, `daily-attempts`, `dates` et `page` complètent la non-régression.

## 2. Inventaire du contrat

Sources locales examinées : `backend/app/schemas.py`, `backend/app/youtube.py` et `frontend/src/lib/youtube.ts`. Dans les lignes ci-dessous, tous les champs vidéo sont nullables sauf `id` et `youtube_url`.

| Champs | Donnée disponible et restitution proposée |
|---|---|
| `id`, `youtube_url` | Identifiant de la vidéo et lien fourni par le backend. Utiliser l’identifiant comme clé stable et le lien sur le titre complet. |
| `title`, `thumbnail_url` | Titre et URL de miniature. Afficher « Titre indisponible » et « Miniature indisponible » selon les cas. Traiter aussi un échec image dans le même emplacement. |
| `channel_id`, `channel_title`, `channel_url` | Identifiant technique, nom et lien. Afficher le nom sous le titre, lié si une URL existe. Conserver « Nom indisponible » avec lien et « Indisponible » sans nom ni lien. |
| `view_count` | Chaîne décimale représentant les vues publiques. Afficher tous les chiffres avec `formatCount` (`BigInt`, regroupement français) et conserver zéro. |
| `subscriber_count`, `subscribers_hidden` | Chaîne décimale du nombre public arrondi par YouTube et indicateur nullable. « Masqués » si vrai, sinon valeur publique ou « Indisponible ». Indiquer l’arrondi par YouTube dans le libellé ou l’aide associée. |
| `published_at` | Horodatage source. Afficher le jour UTC via le formateur actuel et employer `time` avec la valeur source pour un horodatage valide. Le tri continue à utiliser l’instant brut. |
| `duration_iso`, `duration_label`, `broadcast_status` | Durée ISO source, libellé calculé côté backend et statut de diffusion. Afficher le libellé fourni ou « Indisponible », avec priorité à « Direct en cours » et « Diffusion à venir ». La durée ISO n’est actuellement pas exposée comme valeur visible. |

Le backend construit les liens vidéo et chaîne sur `https://www.youtube.com` en encodant les identifiants. Il sélectionne la première miniature HTTPS disponible parmi `high`, `medium` et `default`. Le frontend vérifie les types des champs de la page, tandis que la construction et la sélection des URL se font côté backend. Réutiliser les URL fournies, le rendu texte React, les attributs de lien, le chargement différé et `referrerPolicy="no-referrer"` sur l’image directe. Le remplacement d’image en erreur reste local, sans nouvelle URL ni nouvelle tentative applicative.

Les informations globales sont `items`, `next_page_token`, `next_page_signature`, `page_number`, `omitted_count`, `examined_count`, `retained_count`, `filtered_out_count`, `daily_limit`, `searches_remaining` et `notice`. Les identifiants techniques et le couple de continuation gardent leur rôle actuel. Les nombres publics complets restent lisibles et copiables directement, y compris sur mobile. La précision des valeurs publiques reste celle du contrat.

## 3. Tableau HTML ou liste CSS Grid

| Critère | Tableau HTML sémantique | Liste ordonnée avec CSS Grid |
|---|---|---|
| Accessibilité | En-têtes de colonnes et navigation par cellule native en disposition tabulaire. La transformation CSS mobile exige une vérification des rôles et de l’association des en-têtes. | Lecture linéaire naturelle sur mobile. Des libellés par vidéo sont nécessaires, car les en-têtes visuels desktop n’ont pas d’association native aux valeurs. |
| Comparaison | Alignement commun et colonnes directement identifiables. | Colonnes cohérentes si les gabarits des lignes et des en-têtes restent synchronisés. |
| Réutilisation | Remplace la structure `article/dl`. Réutilise les formateurs, les libellés et les attributs des liens et des images. | Peut réutiliser la liste et davantage du balisage de carte, avec une réorganisation nécessaire pour les colonnes. |
| Maintenance | Une source de données et un rendu. Règles de reflow spécifiques à vérifier avec les technologies d’assistance. | Rendu mobile simple. Plus de coordination entre libellés, en-têtes et pistes CSS desktop. |
| Tests | Assertions sur en-têtes et lignes, puis contrôle du rendu responsive et de l’arbre d’accessibilité. | Assertions sur éléments de liste et libellés locaux, puis contrôle visuel de l’alignement des pistes. |

## 4. Architecture proposée

Utiliser un composant de présentation `VideoResultsTable` alimenté par `displayedVideos`, à l’intérieur de la région actuelle. Un seul DOM de résultats pour toutes les largeurs. Utiliser `table`, `thead`, `tbody`, `tr`, `th scope="col"` et `td` et nommer le tableau à partir du titre « Résultats des pages chargées ». Maintenir l’ordre DOM Vidéo / Chaîne, Vues, Abonnés, Publication, Durée. Les en-têtes restent informatifs. Proposer de remplacer « Le nombre de nouvelles cartes peut être inférieur » par « Le nombre de nouvelles vidéos affichées peut être inférieur » dans l’aide de continuation.

Dans la première cellule, conserver la miniature cliquable et le titre lié, qui reprend aussi l’information d’ouverture dans un nouvel onglet. Le lien d’action répété en bas de carte est repris par le lien du titre, avec un repère externe discret. Garder le lien de chaîne quand il existe et associer l’information d’ouverture aux liens externes. Quand l’image manque ou échoue, afficher le texte de remplacement dans la zone de miniature et conserver le titre comme accès à la vidéo.

## 5. Desktop

| Colonne | Présentation |
|---|---|
| Vidéo / Chaîne | Miniature de départ 104 px en 16:9, complètement à gauche et ajustée dans son cadre. Titre complet souligné et chaîne sous le titre. Colonne principale flexible. |
| Vues | Vues publiques alignées à droite avec chiffres tabulaires. |
| Abonnés | Valeurs alignées à droite avec chiffres tabulaires. Mention visible ou aide adjacente sur l’arrondi public. |
| Publication | Date française avec UTC indiqué dans l’en-tête. |
| Durée | Durée fournie par YouTube ou libellé textuel de diffusion. |

Viser 72–88 px pour une ligne courante, avec séparateurs ardoise fins et espacements réduits. La ligne grandit pour conserver les titres et les noms complets. Autoriser le retour des chaînes sans espace et des grands nombres en dernier recours, chiffres toujours présents dans le texte. Garder ensemble une date ou une durée courante quand la place le permet. Reprendre la palette, la typographie et l’enveloppe de page existantes.

## 6. Responsive, zoom et accessibilité

| Largeur CSS | Disposition proposée |
|---|---|
| 320 px | Miniature d’environ 72 px à gauche, titre et chaîne à droite, puis grille de métadonnées libellées sur la largeur de l’entrée. Laisser les valeurs longues augmenter la hauteur. |
| 375 px | Même structure, miniature de 80–88 px. Viser deux lignes de métadonnées dans le cas courant, avec deux paires libellé/valeur par ligne. |
| 768 px | Disposition comparative à cinq colonnes, miniature de 96 px et en-têtes autorisés à revenir à la ligne. Vérifier l’espace intérieur réel et ajuster le seuil si les fixtures montrent un problème de lecture. |
| 1440 px | Cinq colonnes, miniature d’environ 104 px, dans la largeur de contenu existante. |

**Choix mobile proposé pour validation** — empiler visuellement chaque ligne sous le seuil initial de 768 px en conservant une miniature à gauche, puis présenter les quatre métadonnées avec libellés locaux. Ce format expose les valeurs dans le flux de lecture et évite un balayage horizontal. Les lignes très longues seront plus hautes. Un tableau à défilement horizontal local préserverait mieux les relations entre colonnes et la disposition native, mais demanderait de déplacer la zone pour accéder aux valeurs de droite et de rendre cette zone utilisable au clavier.

Conserver les en-têtes dans l’arbre d’accessibilité en disposition compacte. Vérifier les rôles et associations après la mise en page CSS, notamment sur WebKit si disponible. Si des rôles natifs disparaissent, vérifier le rétablissement des rôles et les associations avant de retenir la technique. Si la navigation ou l’annonce des valeurs reste dégradée, revoir la proposition mobile avant validation. Contrôler les libellés visuels et accessibles pour éviter leur annonce en double. Garder les noms de liens complets, le focus global, les contrastes existants et des états textuels distincts. Vérifier l’ordre de tabulation, l’activation clavier, la visibilité des contours et le reflow lorsque le zoom à 200 % réduit la largeur CSS. Vérifier également la largeur CSS de 320 px indépendamment du zoom.

## 7. Risques et protections

- La disparition des `article` exige d’adapter les sélecteurs des tests sans affaiblir leurs assertions sur les données et l’ordre. Identifier les lignes par rôle dans le corps du tableau et conserver les assertions de liens et de titres.
- Le passage d’une grille de cartes à une ligne par vidéo change la géométrie et les points de focus des liens redondants. Vérifier le parcours complet, y compris le bouton de continuation et le comportement lorsque l’utilisateur quitte ce bouton pendant le chargement.
- Une longue valeur ou un lien peut élargir les colonnes. Tester le retour à la ligne et les contours de focus jusqu’à 320 px, avec grandes valeurs exactes, texte sans espace et zoom.
- Conserver la logique de recherche, de validation, de consentement, des erreurs et du quota, les tris, l’instantané des critères, la continuation, la déduplication et les statistiques. Le bloc d’intégration rend toute la collection unique, jusqu’aux 100 vidéos permises par les pages reçues.
- Maintenir le backend, le contrat HTTP, les pages légales, les secrets, Compose et les dépendances dans leur état actuel. Les vérifications s’exécuteront sur un environnement séparé des services actifs. La restriction historique de Turbopack est à consigner si elle se reproduit.

## 8. Plan de tests

1. Vitest sur les formateurs et le rendu des lignes. Vérifier en-têtes, liens et noms accessibles, date UTC, zéros, grands entiers, données nulles, abonnés masqués, durée et statuts de diffusion, miniature présente, absente et en erreur. Prévoir un contrôle de l’attribution et des attributs d’ouverture.
2. Intégration dans `search.test.tsx`. Conserver les cas 50/100 vidéos et doublons interpages, les trois tris pendant et après continuation, les critères figés et les appels exacts, le focus restitué ou conservé, l’état vide, les erreurs et la reprise, le consentement, les compteurs et le quota. Vérifier que les résultats restent hors de la région d’annonce et que les états de chargement sont conservés.
3. Exécuter `npm test`, `npm run typecheck` puis `npm run build` avec Turbopack et dépendances installées depuis le verrou dans une copie isolée. Consigner les versions réellement exécutées, commandes, codes de sortie et avertissements. Si Turbopack est bloqué, une comparaison supplémentaire avec deux builds Webpack identiques peut documenter l’UX. La validation Turbopack reste ouverte jusqu’à un build réussi.
4. Exécuter les scénarios navigateur simulés à 320, 375, 768 et 1440 px. Observer le clavier, l’arbre d’accessibilité, les cas limites, la continuation, le tri et l’absence de requête de recherche supplémentaire. Tester le zoom navigateur natif à 200 % dans un environnement qui le prend en charge. Une largeur CSS réduite est un contrôle complémentaire et sera signalée comme telle.
5. Recette utilisateur après bilan automatisé. Vérifier la comparaison sur desktop, la lecture sur mobile réel et le parcours clavier avec données simulées. Consigner séparément la validation par lecteur d’écran, l’automatisation de l’arbre d’accessibilité et le retour utilisateur.

## 9. Protocole de mesures UX

- Référence avant : commit audité, après les phases 6.1 et 6.2 et SEC-01. Comparer avec le rendu de phase 6.3 à fixtures, langage, fuseau, OS, versions de navigateur et d’outils, échelle, viewports CSS, type de build et mode de service identiques. Consigner ces paramètres. Utiliser des profils neufs, filtres repliés, même tri de départ et attendre le rendu stabilisé incluant les miniatures au voisinage des zones mesurées.
- Simuler `/api/videos/search` avant la soumission et fournir les images depuis des fixtures locales. Bloquer et journaliser les destinations externes, y compris YouTube. Préparer une première page avec continuation et une seconde avec doublon puis fin, ainsi qu’un scénario de 50 + 50 uniques. Garder compteurs, notice et taille des jeux identiques entre les versions. Inclure texte courant et long, chaîne sans espaces, vues au-delà de la précision sûre de Number, zéro, heures UTC, abonnés masqués, nulls, direct, diffusion à venir et miniatures absentes ou en échec.
- Pour chaque état (une page et deux pages) et viewport principal (1440 × 900 et 375 × 900), mesurer le Y documentaire du début de la liste ou du tableau et de la première vidéo (`getBoundingClientRect().top + scrollY`). Mesurer séparément la hauteur avant le bloc résultats et le décalage interne jusqu’à la première vidéo. Garder aussi la position de début de la synthèse.
- Relever moyenne et maximum en pixels CSS des hauteurs des entrées, bornes de chaque carte ou ligne excluant leurs espaces externes. Pour l’ancienne grille, relever aussi la hauteur de chaque rangée visuelle et le pas vertical, puisqu’une rangée peut contenir deux cartes. Pour les deux versions, relever le pas entre débuts de rangées et la hauteur totale du bloc.
- Compter les vidéos entièrement visibles et celles seulement partiellement visibles, d’abord à scroll zéro, puis dans une fenêtre de 900 px alignée sur le début du bloc de résultats. Conserver une mesure complémentaire alignée sur la première vidéo pour isoler la densité des entrées de la hauteur de l’en-tête du tableau. Consigner le défilement effectivement atteint et les éventuels zéros. Le critère de densité compare les fenêtres alignées, même si la première vidéo est sous le pli au chargement.
- À 375 × 900, relever aussi l’organisation des métadonnées, les retours à la ligne des cas longs, les libellés visibles et les captures. À chaque largeur, contrôler `documentElement.scrollWidth <= innerWidth` et inspecter les cellules, liens et contours de focus pour vérifier qu’aucun contenu n’est rogné. Conserver les mesures brutes et les preuves temporaires hors des fichiers livrés.
- Attribuer le gain de densité aux mesures centrées sur les résultats. Les gains historiques de hauteur des phases 6.1 et 6.2 sont déjà incorporés à la référence et restent documentés dans leurs rapports. Tout écart de Y en phase 6.3 doit être réparti entre hauteur des blocs précédents et hauteur interne du nouveau bloc. Aucune valeur avant/après établie à ce stade.

## 10. Fichiers concernés

- `frontend/src/components/video-search.tsx` pour l’intégration du rendu et le libellé de continuation.
- `frontend/src/components/video-card.tsx` et le composant de présentation proposé `frontend/src/components/video-results-table.tsx`. Vérifier les références avant de remplacer le composant de carte.
- `frontend/src/app/globals.css` si des règles ciblées sont nécessaires au reflow du tableau.
- `frontend/tests/video.test.tsx` et `frontend/tests/search.test.tsx` pour les tests de rendu et d’intégration. `frontend/src/lib/youtube.ts`, `frontend/src/lib/video-sort.ts` et les composants statistiques restent les points de référence à réutiliser.
- `docs/codex-reports/phase-06.3.md` pour conserver le plan et ajouter décisions, bilan, mesures, incidents, réserves et statut de recette.

## 11. Critères de validation et ordre d’implémentation

1. Obtenir la validation utilisateur du plan, du tableau natif et du reflow mobile proposé. Préparer ensuite la référence mesurée isolée en Next.js 16.4.5.
2. Intégrer le tableau avec toutes les vidéos uniques, les cinq colonnes desktop dans l’ordre défini, les valeurs et libellés existants, y compris les liens, et la miniature à gauche. Conserver la palette sombre et le fonctionnement des contrôles.
3. Valider une densité supérieure à 1440 × 900 dans la fenêtre alignée sur les résultats, une lecture compacte à 375 px, le reflow à 320 et 768 px et à 200 % de zoom, sans débordement global ni troncature. Vérifier les liens et le focus, les associations de colonnes et les états textuels.
4. Vérifier la non-régression des trois tris, des deux pages manuelles et de la déduplication, des statuts, du focus, des erreurs et des compteurs. Le journal réseau doit correspondre aux seules recherches simulées déclenchées explicitement.
5. Ajouter au rapport les décisions validées, le bilan des fichiers modifiés, les résultats effectifs des tests et des mesures, les incidents et limites, puis le statut de la recette utilisateur. Une réserve non levée reste visible jusqu’à sa vérification.

**Statut de l’audit** — contrôles Git, lecture du code, du contrat, des tests et vérification statique des versions effectués. Tests, builds, mesures et recette en attente. Aucun service lancé, aucune recherche YouTube et aucun commit.

## 12. Validation et réalisation

L’utilisateur a validé la maquette sombre et le plan, avec un tableau natif, une miniature liée et un reflow compact aux petites largeurs. Il a autorisé l’implémentation après établissement de la référence et demandé une recette avant tout commit. La référence à 100 % a été exécutée sur `de4193694241d73492ac6c16439b78d440d64df6` avant la première modification applicative.

`VideoResultsTable` remplace la grille de cartes et reçoit la collection déjà triée et dédupliquée. Le tableau est nommé par le titre des résultats. Il présente cinq en-têtes natifs `scope="col"` et une ligne par vidéo. Les miniatures font 104 px à 1440 px et 96 px à 768 px, au ratio 16:9. Les nombres sont alignés à droite avec des chiffres tabulaires sur desktop. Les titres et les noms restent complets. La miniature et les cellules suivent le début de la ligne afin de garder les métadonnées au niveau des premières lignes des titres longs.

Sous 768 px, les cellules deviennent une grille compacte. La première cellule occupe toute la largeur, puis deux rangées de métadonnées affichent les libellés. Le même DOM fournit les en-têtes et les cellules à Chromium à ces largeurs. Les libellés mobiles visuels ne répètent pas l’annonce du tableau. Les formats historiques des valeurs restent utilisés. Une miniature absente affiche un texte. Un chargement en erreur affiche le même texte et conserve le lien existant. Le titre souligné assure l’accès principal à YouTube et remplace le troisième lien de l’ancienne carte. La miniature, le titre et le lien éventuel de la chaîne annoncent l’ouverture dans un nouvel onglet. Leur sécurité reste assurée par les attributs existants.

| Fichier | Intervention |
|---|---|
| `frontend/src/components/video-results-table.tsx` | Tableau, identité vidéo, formateurs existants, liens et remplacement de miniature. |
| `frontend/src/components/video-search.tsx` | Rendu du tableau, nom accessible et formulation de l’aide de pagination. |
| `frontend/src/components/video-card.tsx` | Composant retiré après remplacement de ses usages. |
| `frontend/src/app/globals.css` | Styles ciblés du tableau et reflow compact. |
| `frontend/tests/video.test.tsx`, `frontend/tests/search.test.tsx` | Couverture des colonnes, valeurs, miniatures, liens et assertions de recherche sur les lignes. |
| `README.md`, `docs/architecture.md`, `docs/validation.md` | Description de l’interface, de l’intégration et du périmètre de validation. |
| `docs/codex-reports/phase-06.3.md` | Décision, bilan, mesures et recette ajoutés au plan initial conservé. |

### Vérifications exécutées

Environnement isolé Debian ARM64, Node 24.22.2, npm 11.19.1, Next.js 16.4.5 installé dans les deux copies avec `npm ci --offline` depuis le verrou et le cache existant. La comparaison UX utilise deux builds **de production Webpack**, servis depuis leurs artefacts statiques avec Playwright Core 1.65.0. L’installation de travail et les dépendances versionnées sont restées en place.

| Contrôle | Résultat |
|---|---|
| `npm test` | 112 réussites dans 7 fichiers. Les parcours simulés couvrent notamment 50 puis 100 vidéos, la déduplication, les trois tris, la continuation, les erreurs, le consentement, les statistiques et le focus. |
| `npm run typecheck` | Code 0, génération des types Next et vérification TypeScript. |
| `npm run build` | Phase 6.3 finale, Turbopack 16.4.5, code 0. Compilation, vérification TypeScript et génération des pages terminées. |
| `npm run build -- --webpack` | Code 0 sur la référence et la version finale. Artefacts utilisés pour toutes les comparaisons navigateur. |

La référence Turbopack a échoué à traiter `globals.css` avec `binding to a port → Operation not permitted (os error 1)`, en sandbox puis lors de la première relance autorisée. Le parcours Webpack prévu a permis de mesurer la référence avant intervention. Les deux tentatives Turbopack de la version modifiée ont réussi, dont celle sur le CSS final. Le premier lancement Chromium en sandbox a échoué sur une opération IPC (`shutdown: Operation not permitted`). Les sessions autorisées ont utilisé uniquement les routes et ressources simulées. Le contrôle du focus a ensuite été corrigé pour déclencher réellement `Tab` et les assertions sur les valeurs nulles ont été ciblées sur les cellules accessibles.

### Comparaison UX et recette automatisée

Les deux versions ont utilisé les mêmes profils neufs, les filtres repliés, le tri de pertinence initial, la locale `fr-FR`, le fuseau Europe/Paris et Chromium **158.0.8127.18**. L’API simulée renvoie 50 vidéos, puis 50 résultats dont le premier est un doublon, soit 99 vidéos uniques après continuation. Le titre de la sixième vidéo inclut huit répétitions de texte, une séquence de 60 caractères sans espace et un nom de chaîne long. Les fixtures comprennent aussi une miniature absente, une réponse image 404, des champs nuls, zéro, un direct, une diffusion à venir et les valeurs publiques `9007199254740993` et `90071992547409931234567890`. Une date simulée à 23 h 45 avec un décalage de −02:00 affiche le jour UTC suivant. Toutes les images et réponses étaient interceptées sur `youfinder.test`.

Les dimensions et hauteurs ci-dessous sont en pixels CSS. Les paires donnent **avant → après**. La colonne « visibles » indique **entières + partielles**, comptées dans une fenêtre alignée sur le début du bloc de résultats. Elle mesure donc 900 px pour les viewports principaux. Le maximum correspond au cas long dans tous les scénarios.

| Viewport | Pages, vidéos uniques | Hauteur moyenne | Maximum | Visibles au début du bloc | Hauteur du bloc complet |
|---|---|---:|---:|---:|---:|
| 1440 × 900 | 1 page, 50 | 694,55 → 80,985 | 1121,75 → 446,25 | 2 + 2 → 6 + 1 | 17843,75 → 4124,25 |
| 1440 × 900 | 2 pages, 99 | 685,74 → 77,28 | 1121,75 → 446,25 | 2 + 2 → 6 + 1 | 35262,5 → 7725,75 |
| 375 × 900 | 1 page, 50 | 604,546 → 171,503 | 1124,8125 → 548,25 | 1 + 1 → 5 + 1 | 31207,3125 → 8575,15625 |
| 375 × 900 | 2 pages, 99 | 600,966 → 167,496 | 1124,8125 → 548,25 | 1 + 1 → 5 + 1 | 61455,625 → 16582,0625 |
| 320 × 900 | 1 page, 50 | 601,778 → 170,925 | 1491,375 → 664,5 | 1 + 1 → 5 + 1 | 31068,875 → 8546,25 |
| 320 × 900 | 2 pages, 99 | 594,154 → 165,641 | 1491,375 → 664,5 | 1 + 1 → 5 + 1 | 60781,25 → 16398,5 |
| 768 × 900 | 1 page, 50 | 625,85 → 83,255 | 1132,25 → 755,75 | 2 + 2 → 5 + 1 | 16126,25 → 4237,75 |
| 768 × 900 | 2 pages, 99 | 615,407 → 76,199 | 1132,25 → 755,75 | 2 + 2 → 5 + 1 | 31745 → 7618,75 |
| 720 × 450, DPR 2 | 1 page, 50 | 637,55 → 153,87 | 1268,75 → 319 | 0 + 2 → 2 + 1 | 16418,75 → 7693,5 |
| 720 × 450, DPR 2 | 2 pages, 99 | 624,533 → 152,202 | 1268,75 → 319 | 0 + 2 → 2 + 1 | 32200 → 15068 |
| 720 × 456, zoom natif 200 % | 1 page, 50 | 635,441 → 153,87 | 1266,640625 → 319 | 0 + 2 → 3 + 1 | 16366,015625 → 7693,5 |
| 720 × 456, zoom natif 200 % | 2 pages, 99 | 622,423 → 152,202 | 1266,640625 → 319 | 0 + 2 → 3 + 1 | 32094,53125 → 15068 |

| Viewport | Pages | Y du bloc | Y de la première vidéo | Scroll Y atteint au début du bloc |
|---|---|---:|---:|---:|
| 1440 × 900 | 1 | 1377,203125 → 1377,203125 | 1377,203125 → 1451,703125 | 1377 → 1377 |
| 1440 × 900 | 2 | 1285,203125 → 1285,203125 | 1285,203125 → 1359,703125 | 1285 → 1285 |
| 375 × 900 | 1 | 2005,203125 → 2005,203125 | 2005,203125 → 2005,203125 | 2005 → 2005 |
| 375 × 900 | 2 | 1849,203125 → 1849,203125 | 1849,203125 → 1849,203125 | 1849 → 1849 |
| 320 × 900 | 1 | 2281,203125 → 2301,203125 | 2281,203125 → 2301,203125 | 2281 → 2301 |
| 320 × 900 | 2 | 2125,203125 → 2125,203125 | 2125,203125 → 2125,203125 | 2125 → 2125 |
| 768 × 900 | 1 | 1545,328125 → 1545,328125 | 1545,328125 → 1619,828125 | 1545 → 1545 |
| 768 × 900 | 2 | 1433,328125 → 1433,328125 | 1433,328125 → 1507,828125 | 1433 → 1433 |
| 720 × 450, DPR 2 | 1 | 1539,578125 → 1539,578125 | 1539,578125 → 1539,578125 | 1540 → 1540 |
| 720 × 450, DPR 2 | 2 | 1427,578125 → 1427,578125 | 1427,578125 → 1427,578125 | 1428 → 1428 |
| 720 × 456, zoom natif 200 % | 1 | 1539,5859375 → 1539,5859375 | 1539,5859375 → 1539,5859375 | 1539,5 → 1539,5 |
| 720 × 456, zoom natif 200 % | 2 | 1427,5859375 → 1427,5859375 | 1427,5859375 → 1427,5859375 | 1427,5 → 1427,5 |

Au scroll initial, **0 entière et 0 partielle** pour tous les scénarios et les deux versions. À 1440 px, en alignant la fenêtre sur la première vidéo, les comptages passent de **2 + 2** à **7 + 1** sur les deux pages. Dans la fenêtre alignée sur le bloc, l’en-tête de 74,5 px explique la différence de comptage. À 768 px, cet en-tête a également 74,5 px. À 375 px, le début du bloc et celui de la première vidéo coïncident avant comme après. À 320 px sur une page, le libellé de continuation produit un retour supplémentaire et décale le bloc de 20 px. Le début du panneau de synthèse conserve la même position pour chaque largeur dans la paire de mesures. Les gains des phases 6.1 et 6.2 sont déjà inclus dans la référence et les comptages alignés isolent la densité apportée par la phase 6.3.

Le zoom natif a été appliqué dans Chrome for Testing avec `chrome.tabs.setZoom(tab.id, 2)`, puis relu par `chrome.tabs.getZoom`. Le viewport intérieur est passé de 1440 × 913 à 720 × 456 CSS, avec un DPR de 1 à 2 et un `scrollWidth` de 712 pour `innerWidth` de 720 après zoom. La variante 720 × 450 avec DPR 2 est une mesure complémentaire en viewport simulé. Aucune largeur n’a présenté de débordement horizontal du document.

#### Distribution brute des hauteurs

Les valeurs ci-dessous sont les hauteurs exactes des entrées, suivies de leur fréquence. Dans l’ancienne grille à deux colonnes, la hauteur d’une carte peut être celle imposée à sa rangée par la carte voisine. Le relevé JSON conserve également les hauteurs en ordre d’affichage ainsi que les hauteurs et pas des rangées visuelles.

| Viewport | Pages | Avant, px × fréquence | Après, px × fréquence |
|---|---|---|---|
| 1440 × 900 | 1 | 676,75 × 48, 1121,75 × 2 | 73,5 × 48, 75 × 1, 446,25 × 1 |
| 1440 × 900 | 2 | 676,75 × 97, 1121,75 × 2 | 73,5 × 97, 75 × 1, 446,25 × 1 |
| 375 × 900 | 1 | 431,5 × 1, 597,3125 × 48, 1124,8125 × 1 | 163,40625 × 48, 183,40625 × 1, 548,25 × 1 |
| 375 × 900 | 2 | 431,5 × 1, 597,3125 × 97, 1124,8125 × 1 | 163,40625 × 97, 183,40625 × 1, 548,25 × 1 |
| 320 × 900 | 1 | 451,5 × 1, 586,375 × 48, 1491,375 × 1 | 160,25 × 46, 165 × 2, 180,25 × 1, 664,5 × 1 |
| 320 × 900 | 2 | 451,5 × 1, 586,375 × 97, 1491,375 × 1 | 160,25 × 95, 165 × 2, 180,25 × 1, 664,5 × 1 |
| 768 × 900 | 1 | 604,75 × 48, 1132,25 × 2 | 69 × 48, 95 × 1, 755,75 × 1 |
| 768 × 900 | 2 | 604,75 × 97, 1132,25 × 2 | 69 × 97, 95 × 1, 755,75 × 1 |
| 720 × 450, DPR 2 | 1 | 611,25 × 48, 1268,75 × 2 | 150,5 × 49, 319 × 1 |
| 720 × 450, DPR 2 | 2 | 611,25 × 97, 1268,75 × 2 | 150,5 × 98, 319 × 1 |
| 720 × 456, zoom natif 200 % | 1 | 609,140625 × 48, 1266,640625 × 2 | 150,5 × 49, 319 × 1 |
| 720 × 456, zoom natif 200 % | 2 | 609,140625 × 97, 1266,640625 × 2 | 150,5 × 98, 319 × 1 |

Les JSON, les captures alignées et le script des scénarios sont conservés localement dans `frontend/node_modules/.cache/phase63-evidence/`. Le script a été exécuté dans `/tmp/youfinder63`, avec les builds sous `before` et `after`. Les captures à 375 et à 1440 px ont été inspectées. Les valeurs longues restent complètes et peuvent occuper plusieurs lignes. La miniature reste à gauche et les quatre libellés de métadonnées sont visibles dans le flux compact.

Chromium a exposé un tableau nommé, cinq en-têtes et cinq cellules par vidéo à toutes les largeurs testées, y compris au zoom natif. L’ordre de tabulation miniature → titre → chaîne et le contour de focus du titre ont été contrôlés. L’activation de la continuation avec Entrée restaure le focus au résumé, et le journal confirme la reprise des critères soumis, le jeton et la signature. Le parcours à 375 px a en plus vérifié une erreur HTTP 503 de continuation, le maintien des 50 lignes, puis la reprise manuelle donnant 99 lignes. Les trois options de tri n’ont déclenché aucun nouvel appel. Aucune destination externe demandée et aucune erreur JavaScript détectée pendant ces contrôles. La couverture de 100 vidéos uniques et des ordres de tri provient également de Vitest.

### Limites et recette utilisateur

- Vérifier le confort de lecture à 1440 et 768 px puis sur un appareil mobile à 320–375 px, avec une miniature en erreur, un titre long et un grand nombre réparti sur plusieurs lignes.
- Vérifier Safari et la lecture effective des en-têtes et des cellules avec VoiceOver ou un autre lecteur d’écran. Le contrôle Chromium porte sur l’arbre d’accessibilité, le clavier et le zoom. Si le reflow fait perdre les relations en-tête/cellule sur un navigateur cible, le repli à évaluer est le tableau natif dans une zone de défilement horizontal locale accessible au clavier, avec ses cinq colonnes.
- Confirmer au clavier les liens d’ouverture en nouvel onglet, le focus après continuation et le confort du reflow à 200 % dans le navigateur habituel. Utiliser les réponses simulées pour la recette.
- La recette utilisateur reste en attente. Aucun commit, déploiement, accès OVH ou changement aux services actifs.

## Ajustements UX après recette utilisateur

La première recette visuelle a confirmé la densité générale du tableau. L’utilisateur a demandé des en-têtes plus courts, la suppression du préfixe devant le nom de chaîne et un repère pour situer chaque vidéo dans les résultats cumulés.

- `frontend/src/components/video-results-table.tsx` affiche exactement « Vidéo / Chaîne », « Vues », « Abonnés », « Publication » et « Durée ». Les libellés courts restent visibles avec leurs valeurs en disposition mobile. La date est toujours au jour UTC et les valeurs publiques gardent leur format intégral. Les états masqués, indisponibles et de diffusion gardent leurs libellés.
- Ce même composant affiche l’index plus un dans la première cellule, avant la miniature. Le repère suit la collection `displayedVideos`, déjà triée et dédupliquée. Il se recalcule avec le tri et continue sur les deux pages. Il est visuel, sans arrêt de tabulation ni annonce en doublon de la position de ligne. Les liens gardent leurs noms et descriptions.
- `frontend/src/app/globals.css` ajoute un encart de 32 px sur desktop et de 28 px sur mobile, ainsi qu’un espacement réduit dans la première cellule.
- `frontend/tests/search.test.tsx` vérifie la suite de 1 à 50 puis à 100, ainsi que les positions après tri et déduplication. `frontend/tests/video.test.tsx` vérifie les cinq en-têtes visibles et accessibles, la chaîne sans préfixe, la valeur publique d’abonnés au-delà de la précision sûre de JavaScript, ainsi que les liens et états existants.
- `docs/validation.md` consigne la recette automatisée des ajustements. `docs/backlog.md` contient l’entrée de la phase 6.4.

**Vérifications finales.** Dans la copie isolée avec Next.js 16.4.5, `npm test` a donné 112 réussites sur 7 fichiers. `npm run typecheck` et `npm run build` avec Turbopack ont réussi. La recette Chromium 158.0.8127.18 a utilisé les artefacts du build Turbopack et les réponses simulées. Les largeurs 320, 375, 768 et 1440 px et le zoom natif à 200 % passent sans débordement horizontal du document. Les cinq en-têtes restent exposés. Le clavier suit les liens miniature, titre et chaîne, avec un focus visible sur le titre. Après continuation au clavier, le focus revient au résumé. La recette a vérifié les positions de 1 à 99 sur deux pages avec doublon et leur recalcul lors des tris, sans appel supplémentaire. Le scénario d’échec de continuation puis de reprise à 375 px a réussi. Aucune destination externe sollicitée. Les captures et relevés sont conservés dans le sous-dossier local `adjustments` des preuves.

Dans la version ajustée, six vidéos entières sont visibles dans la fenêtre alignée de 900 px à 1440 px, et cinq à 375 px. Le cas de titre très long à 320 px occupe 821,75 px de hauteur, car le titre et la chaîne reviennent à la ligne sur l’espace disponible à droite du numéro et de la miniature.

**Recette utilisateur à renouveler.** Vérifier sur mobile réel le confort de lecture des titres les plus longs et des nombres sur plusieurs lignes, ainsi que la lecture des cellules avec Safari et VoiceOver ou un autre lecteur d’écran. Aucun commit avant ce retour.
