# SEC-01 — Correctif Next.js, novembre 2026

## Statut et décision proposée

Audit et plan du **16 novembre 2026**, **en attente de validation avant implémentation**.

Proposition minimale : remplacer la version exacte **Next.js 16.4.3 par 16.4.5**, conserver **React/React DOM 19.3.1** et **Node 24.22.2**, puis régénérer le verrou de manière ciblée. La publication officielle 16.4.5 contient les sept correctifs de novembre. 16.4.4 reste vulnérable ; 16.4.6 est disponible mais ajoute des correctifs fonctionnels et n’est pas nécessaire pour couvrir ces sept avis. Sources : [release 16.4.5](https://github.com/vercel/next.js/releases/tag/v16.4.5), [bulletin Next.js de novembre](https://nextjs.org/blog/november-2026-security-release), [release 16.4.6](https://github.com/vercel/next.js/releases/tag/v16.4.6).

**Aucune dépendance modifiée ou installée pour cet audit.** Seul ce rapport est créé dans le dépôt. Aucun code applicatif, configuration Next.js, Dockerfile, Compose, backend ou secret modifié. Aucun commit, déploiement, accès OVH ou appel YouTube réel. L’avertissement historique reste ouvert jusqu’à validation et vérification du correctif.

## État initial et audit local

`AGENTS.md` lu ; branche vérifiée : **`fix/nextjs-security-2026-11`**, HEAD **`a54b11d`**. État Git initial propre. Aucun changement de branche effectué.

| Élément | Valeur constatée |
| --- | --- |
| `frontend/package.json` | `next: "16.4.3"`, `react: "19.3.1"`, `react-dom: "19.3.1"`, versions exactes |
| `frontend/package-lock.json` | lockfile v3 ; racine et entrées Next/React/React DOM concordantes ; URL npm et intégrité présentes |
| `frontend/node_modules/*/package.json` | Versions installées identiques aux versions déclarées et verrouillées |
| Next transitif | `@next/env` et huit variantes optionnelles `@next/swc-*` verrouillées en 16.4.3 |
| Image native | `sharp` verrouillé en **0.35.5** |
| Node projet | `engines.node: ">=24.22.2 <25"` |
| Node Docker | `24.22.2-bookworm-slim`, image avec digest explicite ; aucun changement proposé |
| `docs/versions.json` | Référence Next 16.4.3 ; autres versions et digests cohérents avec les fichiers examinés |

Sources locales examinées : manifeste, verrou, métadonnées installées, `frontend/Dockerfile`, `frontend/next.config.ts`, inventaire `frontend/src` et `frontend/public`, composants de recherche/cartes, `docs/versions.json`, bilan de phase 6.2, modules installés `next/dist/lib/upgrade/nudge.js` et `prepare-upgrade.js`.

L’application utilise l’App Router ; pages `/`, `/conditions`, `/confidentialite`, sans route dynamique ni Pages Router. Le code de recherche effectue un `fetch` **dans le navigateur**, vers `/api/videos/search`, avec `cache: "no-store"`. La configuration expose un rewrite vers une adresse backend de confiance issue de la configuration serveur. Aucun Route Handler retournant une `Response` upstream, `use cache`, `unstable_cache`, Cache Components activé, route Edge, écriture de cookie ou `next/og` observé. Les images utilisent des balises `img`, pas `next/image` ; le seul asset public est un PNG. L’absence de composant `next/image` ne désactive pas à elle seule l’endpoint d’optimisation du framework.

## Avis applicables à la version 16.4.3

Distinguer **appartenance de la version à la plage vulnérable** et **préconditions d’exploitation dans l’application**. Les sept avis suivants sont publiés par les mainteneurs le 3 novembre 2026 ; tous incluent 16.4.3 et indiquent **16.4.5** comme correctif de la branche 16. Les identifiants CVE proviennent de l’[API officielle des advisories du dépôt](https://api.github.com/repos/vercel/next.js/security-advisories?per_page=100), consultée en lecture seule ; aucun identifiant inventé.

| Avis officiel / CVE | Plage affectée 16.x | Correctif | Impact et préconditions ; lecture statique YouFinder |
| --- | --- | --- | --- |
| [GHSA-mfr8-8qww-v76h](https://github.com/vercel/next.js/security/advisories/GHSA-mfr8-8qww-v76h) / CVE-2026-119790 | `>=16.3.0 <=16.4.4` | 16.4.5 | Fuite entre paramètres racine lorsque la même fonction `use cache` est appelée directement et via `unstable_cache`, avec concurrence lors d’un remplissage initial. Aucun de ces caches ni paramètre racine dynamique observé. |
| [GHSA-vc7v-qv4w-wrv8](https://github.com/vercel/next.js/security/advisories/GHSA-vc7v-qv4w-wrv8) / CVE-2026-119351 | `>=16.2.0 <=16.4.4` | 16.4.5 | Fuite dans des caches imbriqués avec métadonnées de flux retardées et paramètres racine. Cache Components et fonctions imbriquées non observés. |
| [GHSA-rhh4-g77r-r9qj](https://github.com/vercel/next.js/security/advisories/GHSA-rhh4-g77r-r9qj) / CVE-2026-119349 | `>=16.0.0 <=16.4.4` | 16.4.5 | Collision de clés pour arguments binaires de `use cache`, pouvant partager ou empoisonner des données entre utilisateurs. `use cache` non observé. |
| [GHSA-vvgp-ww4w-46vf](https://github.com/vercel/next.js/security/advisories/GHSA-vvgp-ww4w-46vf) / CVE-2026-119350 | `>=16.4.0 <=16.4.4` | 16.4.5 | Empoisonnement de shells partagés sous `next start`, Cache Components, Partial Prefetching absent/désactivé et structure dynamique spécifique. Aucun de ces paramètres ou routes dynamiques observé. |
| [GHSA-pc58-hwjq-p385](https://github.com/vercel/next.js/security/advisories/GHSA-pc58-hwjq-p385) / CVE-2026-119348 | `>=16.0.0 <=16.4.4` | 16.4.5 | Désynchronisation de réponses upstream retournées inchangées, derrière un reverse proxy HTTP/1.1 avec mise en file de réponses pipelinées. Aucun tel Route Handler observé ; un rewrite n’est pas une preuve de ce chemin. Proxy réel non audité, exploitation non démontrée. |
| [GHSA-7qx7-33qx-rqx2](https://github.com/vercel/next.js/security/advisories/GHSA-7qx7-33qx-rqx2) / CVE-2026-119347 | `>=16.0.0 <=16.4.4` | 16.4.5 | Contournement du refus SVG dans `/_next/image` sur une source autorisée avec décodeur natif SVG. Aucun usage applicatif de l’optimiseur ni source SVG contrôlée par un attaquant observé ; surface framework à conserver dans le périmètre du correctif. Pas de preuve de XSS ou RCE propre à cet avis. |
| [GHSA-f3mh-rxg3-f5g2](https://github.com/vercel/next.js/security/advisories/GHSA-f3mh-rxg3-f5g2) / CVE-2026-119346 | `>=16.0.0 <=16.4.4` | 16.4.5 | Cookies HttpOnly dupliqués dans un en-tête public de routes Edge utilisant `NextResponse.cookies.set()`. Aucune route Edge ni écriture de cookie observée. |

Les sept fiches mainteneurs classent ces avis **Moderate** au moment de la consultation. Le bulletin de novembre qualifie le premier de **High Severity** : divergence conservée, pas de recalcul local de sévérité. Le manque de préconditions observées réduit l’exposition démontrée mais ne dispense pas du correctif du framework ; aucun test d’exploitation ni audit de production réalisé.

Les avis `pc58`, `7qx7` et `f3mh` indiquent aussi des branches 15.x affectées et le correctif 15.5.29 ; ces branches ne sont pas installées ici. Aucun downgrade de majeure proposé.

### Origine probable de SecurityFatalError et différences entre flux

Le code installé de Next.js interroge le service npm `/-/npm/v1/security/advisories/bulk`, puis compare les plages avec semver. Son mécanisme autorise une relance après rappel ; cette relance ne corrige pas le paquet.

Requête de lecture effectuée à ce service avec **uniquement** `{"next":["16.4.3","16.4.5"]}` : un avis retourné, **GHSA-mfr8-8qww-v76h**, plage `>=16.3.0 <=16.4.4`, URL [GitHub Reviewed](https://github.com/advisories/GHSA-mfr8-8qww-v76h). Comparaison locale : 16.4.3 et 16.4.4 correspondent ; 16.4.5 et 16.4.6 ne correspondent pas à cette plage.

La [requête GitHub Reviewed filtrée sur next@16.4.3](https://api.github.com/advisories?ecosystem=npm&affects=next%4016.4.3&per_page=100) renvoie également ce seul avis. Les six autres sont pourtant présents dans le bulletin et les fiches mainteneurs. Le flux npm n’est donc pas considéré comme une liste exhaustive des sept avis ; son absence de signal pour 16.4.5 n’est pas une preuve universelle d’absence de vulnérabilité.

**Conclusion limitée :** ce signal npm est cohérent avec l’avertissement observé en phase 6.2, mais le payload de l’époque n’a pas été conservé ; impossible d’attribuer rétroactivement avec certitude cette exécution à un avis unique. Aucun nouveau build n’a été lancé pour reproduire l’erreur pendant cet audit.

### Anciens avis : éviter les faux rattachements à 16.4.3

Le catalogue des mainteneurs consulté contient 79 avis. Certaines fiches de septembre conservent des plages ouvertes et un correctif littéral `16.3.?`. Elles ne sont pas utilisées telles quelles pour conclure que toutes les versions ultérieures sont encore vulnérables. Recoupement avec les entrées GitHub Reviewed normalisées et le [bulletin officiel de septembre](https://nextjs.org/blog/september-2026-security-release), qui annonce 16.3.8 :

| Avis | Plage 16.x normalisée / correctif | Conclusion pour 16.4.3 |
| --- | --- | --- |
| [GHSA-39w2-rjm5-chcv](https://github.com/advisories/GHSA-39w2-rjm5-chcv), fuite MCP du serveur de développement | `>=16.0.0 <16.3.8` ; 16.3.8 | Hors plage ; le projet utilise bien `next dev`, donc l’exclusion repose sur la version corrigée |
| [GHSA-4jqv-mc3x-m676](https://api.github.com/advisories/GHSA-4jqv-mc3x-m676), cache Pages Router SSG/ISR | `>=16.0.0 <16.3.8` ; 16.3.8 | Hors plage et absence de Pages Router |
| [GHSA-mcj8-r9mp-w47p](https://api.github.com/advisories/GHSA-mcj8-r9mp-w47p), cache catch-all | `>=16.0.0 <16.3.8` ; 16.3.8 | Hors plage et absence de page catch-all |
| [GHSA-f87g-xv8r-7p7x](https://api.github.com/advisories/GHSA-f87g-xv8r-7p7x), images de métadonnées | `>=16.0.0 <16.3.8` ; 16.3.8 | Hors plage ; aucune route d’image de métadonnées observée |
| [GHSA-cjq9-62q9-8jv4](https://api.github.com/advisories/GHSA-cjq9-62q9-8jv4), SSRF optimiseur | `>=16.0.0 <16.3.8` ; 16.3.8 | Hors plage ; pas de `images.remotePatterns` configuré |

L’[avis critique SVG d’octobre GHSA-2464-fhr4-w9xw](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw), CVE-2026-96889, concerne en 16.x `>16.0.0 <=16.4.0`, corrigé en 16.4.1. Le verrou actuel contient déjà `sharp` 0.35.5, version de mitigation indiquée par l’avis. Ne pas confondre ce RCE avec le contournement SVG de novembre. Les avis d’octobre [GHSA-673q-mjm6-r5xr](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr) et [GHSA-p3m5-59mp-jv5r](https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r) s’arrêtent également à 16.4.0 et indiquent 16.4.1 comme correctif 16.x dans le catalogue consulté. Ils ne justifient pas une attribution de RCE à la version 16.4.3.

Cette recherche cible les avis Next.js applicables à la version installée ; ce n’est pas un audit exhaustif de toutes les dépendances ni une validation dynamique des correctifs historiques.

## Compatibilité et choix de version

Métadonnées de la version cible lues depuis le [registre npm officiel, next 16.4.5](https://registry.npmjs.org/next/16.4.5) et recoupées avec le [manifeste au tag v16.4.5](https://github.com/vercel/next.js/blob/v16.4.5/packages/next/package.json).

| Contrainte cible | Version conservée | Vérification effectuée |
| --- | --- | --- |
| Next 16.4.5 : Node `>=20.9.0` | 24.22.2 | Compatible par comparaison semver ; satisfait aussi `>=24.22.2 <25` du projet |
| Next : React `^18.2.0 || 19.0.0-rc-de68d2f4-20241204 || ^19.0.0` | 19.3.1 | Compatible par comparaison semver |
| Next : React DOM, même plage | 19.3.1 | Compatible par comparaison semver |
| React DOM installé : React `^19.3.1` | 19.3.1 | Déclaration locale satisfaite ; couple conservé |

Les contraintes Node et pairs React ne changent pas entre 16.4.3 et 16.4.5. La comparaison des métadonnées montre seulement les changements de version `@next/env` et des huit variantes SWC dans les dépendances déclarées de Next. Les autres dépendances déclarées, dont `sharp: ^0.35.5`, restent identiques. La résolution réelle du prochain lockfile reste à vérifier ; pas de promesse d’un diff exact avant sa génération.

Le registre `next/latest` retourne **16.4.6** au moment de cet audit. Sa release du 9 novembre mentionne notamment compression des réponses Route Handler et GC Turbopack en développement, sans nouvel avis de sécurité dans sa liste. **16.4.5 reste le premier patch corrigeant les sept avis identifiés** ; 16.4.6 est une alternative à reconsidérer si les validations révèlent une régression pertinente, avec justification avant élargissement. Ne pas utiliser `next@latest` pour cette maintenance ciblée.

La compatibilité de versions n’est pas une garantie de non-régression : tests, types, build et recette restent requis après installation autorisée.

## Modifications minimales proposées après validation

1. Sauvegarder les fichiers concernés et leurs empreintes, relever de nouveau branche et état Git ; conserver les éventuels changements utilisateur.
2. Dans une copie de travail isolée, mettre uniquement `dependencies.next` à **`"16.4.5"`**, sans plage `^`/`~`. Commande envisagée, **non exécutée** : `npm install --save-exact next@16.4.5 --no-audit --no-fund` depuis le frontend, avec Node 24.22.2. Ne pas utiliser `npm audit fix --force` ni la commande automatique `next upgrade` pour élargir le changement.
3. Examiner le diff du verrou v3 : entrée racine, `next`, `@next/env`, binaires `@next/swc-*`, URL et intégrités. Conserver React/React DOM, outils frontend et dépendances non nécessaires. Justifier toute résolution transitive supplémentaire ; ne pas éditer manuellement les intégrités.
4. Vérifier `npm ci` dans une copie propre, sans toucher `node_modules` ni `.next` d’un service actif. Aucun changement de Dockerfile, image Node, Compose, API, configuration de cache ou comportement applicatif attendu.
5. Actualiser uniquement la référence npm Next de `docs/versions.json` et documenter sa vérification ponctuelle sans prétendre revérifier les digests d’images. Compléter ce même rapport et `docs/validation.md` avec les résultats réellement obtenus. Conserver les avertissements historiques de phase 6.2 et les relier au bilan SEC-01 plutôt que les effacer.

Fichiers prévus : `frontend/package.json`, `frontend/package-lock.json`, `docs/versions.json`, `docs/validation.md` et ce rapport. Aucun nouveau composant, aucune dépendance fonctionnelle supplémentaire ou modification de règle métier proposée. README à ajuster seulement si une consigne de version y devient inexacte.

## Plan de tests et critères d’acceptation

Toutes les étapes ci-dessous sont **prévues, non exécutées pour SEC-01**.

1. **Référence avant changement** : suite frontend sur 16.4.3 ; vérifier manifeste/verrou, versions installées et état Git. Les 110 tests de phase 6.2 sont une référence historique, pas un résultat SEC-01.
2. **Installation reproductible** : `npm ci` avec le nouveau verrou dans un environnement isolé ; `npm ls next react react-dom @next/env` et vérification des versions SWC de la plateforme. Vérifier que le diff est limité et que le couple React reste 19.3.1.
3. **Sécurité des versions** : reconsulter les sept advisories et leurs éventuelles mises à jour ; comparer les plages à 16.4.5. Relire le service npm bulk. Un `npm audit --json` complémentaire pourra documenter les dépendances transitives, sans correction automatique ; distinguer ses autres alertes du périmètre Next.js. L’absence d’avertissement de build ou un audit vide ne suffisent pas seuls à prouver le correctif.
4. **Tests frontend complets** : `npm test` ; ne supprimer aucun scénario. Couvrir les quatre indicateurs et valeurs exactes, cas zéro/inconnu/périmé/plafond nul, recherche et filtres, consentement, critères conservés, pagination manuelle limitée à deux pages, jetons/signatures, doublons, tri, erreurs et focus.
5. **Types et build** : `npm run typecheck`, puis `NEXT_TELEMETRY_DISABLED=1 npm run build` avec Turbopack et cache isolé. Consigner code de sortie et avertissements. Rechercher spécifiquement `SecurityFatalError` et les erreurs de SWC/hydratation/CSS. En cas de restriction d’environnement, conserver l’erreur exacte ; ne pas changer la configuration pour masquer le problème. Une relance réussie de l’ancien mécanisme de rappel ne vaut pas correction de version.
6. **Recette navigateur avec données simulées** : mêmes parcours principaux qu’en phase 6.2 à 375 × 900 et 1440 × 900, une page puis deux avec doublon, erreurs puis reprise, quota nul, omissions et tri local. Vérifier quatre indicateurs, deux/quatre colonnes, absence de débordement, bouton avant les cartes, focus et pages légales. Intercepter les recherches avant soumission et bloquer les destinations externes ; aucune clé, aucun appel réel YouTube.
7. **Serveur et rewrite** : si l’environnement permet un serveur de test isolé, vérifier démarrage Next et routage `/api/*` vers un upstream local simulé, réponses et erreurs, sans backend YouTube ni modification d’un service existant. Ne pas considérer les anciennes recettes par interception d’assets comme un test du proxy réel.
8. **Contrôles finaux** : `git diff --check`, inventaire des fichiers modifiés, cohérence documentation/verrou ; distinguer les tests Codex exécutés des confirmations Docker utilisateur. Aucun déploiement implicite après réussite.

Acceptation : version exacte 16.4.5 installable de façon reproductible, React/Node conservés, sept avis hors plage, tests/types/build et recette réussis ou blocages explicitement ouverts ; aucune régression métier ni modification hors périmètre. Toute nouvelle alerte applicable empêche de déclarer SEC-01 intégralement résolu sans examen.

## Plan de rollback

Déclencheurs : échec reproductible d’installation, build/types en régression, défaut de recherche/pagination/tri/focus, erreur de runtime ou résolution transitive incompatible.

- Conserver avant changement une copie de `package.json`, `package-lock.json` et de la référence de versions, avec empreintes et HEAD de départ. Conserver aussi les logs de validation. Aucun commit automatique requis.
- Restaurer **ensemble** les deux fichiers npm depuis cette copie, uniquement pour les modifications SEC-01, après vérification qu’aucune modification utilisateur ultérieure n’est écrasée ; restaurer la référence documentaire correspondante. Pas de `git reset --hard`, nettoyage global ou suppression de volume.
- Réinstaller via `npm ci` dans l’environnement de validation isolé et refaire les contrôles utiles. Si une application en cours doit être redémarrée/reconstruite, obtenir l’autorisation correspondante ; aucun service existant modifié dans cet audit.
- Le retour à 16.4.3 rétablit l’exposition aux avis : conserver **SEC-01 ouvert**, documenter la régression et préparer une autre version corrigée. Ce retour de dépannage n’est pas une remédiation de sécurité ni une autorisation de déploiement de la version vulnérable.

## Contrôles réellement effectués, limites et suite

Effectués : lecture des consignes, branche/HEAD/état Git, analyse statique des versions et surfaces utilisées, consultation des advisories mainteneurs et GitHub Reviewed, releases 16.4.4/16.4.5/16.4.6, bulletins officiels septembre/novembre, lecture des métadonnées npm, requête npm bulk limitée à Next et comparaisons semver avec le module déjà installé. Aucun `npm install`, `npm ci`, `npm audit` global, test applicatif, build ou navigateur exécuté pendant SEC-01.

L’outil GitHub connecté a échoué avec `Unknown tool` ; les sources officielles ont été lues via navigateur et `curl`. DNS npm indisponible en sandbox (`Could not resolve host`) ; lectures publiques réussies après autorisation, fichiers de travail stockés sous `/tmp/youfinder-sec01-*`. Le blog de novembre n’était pas accessible via l’outil web, mais son HTML officiel a été obtenu avec succès par `curl`. Aucune donnée privée envoyée aux services d’advisories ; les versions Next publiques étaient les seules données du payload npm.

Réserves : sources évolutives à recontrôler au moment de l’implémentation ; divergences de sévérité et de publication entre flux conservées ; pas de preuve d’exploitation ni audit OVH/proxy réel ; pas de validation runtime de 16.4.5 à ce stade. Aucun test historique Docker de phase 6.1 ou recette fonctionnelle de phase 6.2 n’est présenté comme un test SEC-01.

**Étape suivante : attendre la validation utilisateur de la cible 16.4.5 et de ce plan avant toute modification des dépendances.** Le bilan d’implémentation, les résultats, les limites et la recette seront ajoutés à ce même fichier.

Contrôles documentaires : `git diff --check` réussi ; vérification du nouveau rapport par `git diff --no-index --check /dev/null docs/codex-reports/security-nextjs-2026-11.md` sans diagnostic de whitespace (code 1 normal pour un fichier nouveau). `git diff --exit-code` sur les deux fichiers npm et `docs/versions.json` confirme leur absence de modification. L’état Git final ne contient que ce rapport non suivi, sur la branche demandée.

## Implémentation autorisée et bilan SEC-01 — 16 novembre 2026

Le plan initial ci-dessus est conservé. L’utilisateur a validé l’implémentation exacte **16.4.3 → 16.4.5**, le maintien de React/React DOM 19.3.1, Node 24.22.2 et npm inchangé. Les mentions antérieures d’attente décrivent l’état du plan avant cette autorisation.

**Statut : correctif appliqué aux fichiers livrés, installation isolée vérifiée ; validation complète bloquée (`blocked`) par Turbopack dans Codex et recette utilisateur en attente.** Ne pas déclarer l’environnement actif corrigé : ses dépendances ont été préservées et restent en 16.4.3 jusqu’à leur actualisation autorisée. Aucun commit ni déploiement.

### Préparation et reconfirmation des avis

`AGENTS.md` relu ; branche `fix/nextjs-security-2026-11`, HEAD `a54b11d140321293f415c295a978a78f29a1e8dd`. À l’ouverture, seul ce rapport était non suivi ; son contenu initial est conservé. Copies initiales et empreintes relevées avant modification du manifeste/verrou.

Relecture avant installation de la [release officielle 16.4.5](https://github.com/vercel/next.js/releases/tag/v16.4.5), du [catalogue mainteneurs](https://api.github.com/repos/vercel/next.js/security-advisories?per_page=100), de la [requête GitHub Reviewed pour la cible](https://api.github.com/advisories?ecosystem=npm&affects=next%4016.4.5&per_page=100) et des [métadonnées npm 16.4.5](https://registry.npmjs.org/next/16.4.5). Catalogue toujours à **79 avis**, aucun nouvel identifiant par rapport à l’audit initial ; GitHub Reviewed retourne une liste vide pour 16.4.5. Les sept avis conservent tous **16.4.5** comme correctif, sans retrait.

Comparaison semver exécutée pour chacun des sept identifiants du plan : **16.4.3 appartient à la plage affectée ; 16.4.5 n’y appartient plus**. Le contrôle vise les sept avis indépendamment de la couverture du flux npm. Le signal historique `SecurityFatalError` n’a pas été reproduit dans la copie corrigée, notamment lors du build Webpack complet ; il ne réapparaît pas non plus dans les deux sorties Turbopack interrompues. Cette absence ne suffit pas seule à prouver l’absence de vulnérabilité.

Une investigation indépendante avant modification et une revue indépendante du diff ont été effectuées en lecture seule avec le skill `codex-security:fix-finding`. Elles confirment l’absence de changement applicatif nécessaire et la nécessité de préserver les variantes natives SWC. La surface `/_next/image` reste accessible au niveau du framework même sans composant `next/image` ; elle a fait l’objet des contrôles locaux décrits ci-dessous. Les chemins de cache, de routes Edge et de retour de `Response` concernés par les autres avis n’ont pas de caller applicatif observé ; aucun exploit complet de ces chemins n’est revendiqué.

La revue a relevé deux points : une ancienne phrase du README affirmant le verrou inchangé, corrigée ; l’installation active toujours en 16.4.3, conservée délibérément selon l’instruction utilisateur et désormais signalée explicitement. La fermeture de cette dernière réserve nécessite l’actualisation autorisée de l’environnement habituel, sans suppression de volume.

### Diff des dépendances réellement réalisé

`npm install --save-exact next@16.4.5` a été exécuté dans une copie isolée, puis `npm ci` a recréé son installation depuis le verrou généré. Les fichiers npm contrôlés ont ensuite été reportés dans le dépôt. Le tri automatique des clés `devDependencies` par npm a été retiré du manifeste : seul le numéro Next change dans `package.json`, sans changement sémantique de l’installation validée.

| Élément du verrou | Avant | Après | Justification |
| --- | --- | --- | --- |
| Racine `dependencies.next` et paquet `next` | 16.4.3 | 16.4.5 | Correctifs du framework, version exacte |
| `@next/env` | 16.4.3 | 16.4.5 | Dépendance exacte de la release Next |
| `@next/swc-darwin-arm64`, `darwin-x64` | 16.4.3 | 16.4.5 | Compilateurs optionnels macOS alignés sur Next |
| `@next/swc-linux-arm64-gnu`, `linux-arm64-musl` | 16.4.3 | 16.4.5 | Compilateurs optionnels Linux ARM64 alignés sur Next |
| `@next/swc-linux-x64-gnu`, `linux-x64-musl` | 16.4.3 | 16.4.5 | Compilateurs optionnels Linux x64 alignés sur Next |
| `@next/swc-win32-arm64-msvc`, `win32-x64-msvc` | 16.4.3 | 16.4.5 | Compilateurs optionnels Windows alignés sur Next |

**Onze entrées JSON changent : racine + dix paquets.** Aucun paquet ajouté ou retiré du verrou, toujours **233 entrées racine comprise**. URL `resolved` et intégrités régénérées par npm pour les dix paquets, sans édition manuelle ; dépendances déclarées de Next ajustées pour `@next/env` et SWC. Toutes les autres entrées du verrou sont identiques, dont React, React DOM, `sharp` 0.35.5 et les outils de test. Les huit plateformes SWC restent présentes. Aucun `next@latest`, `next upgrade`, `npm audit fix` ou changement de npm global.

### Versions réellement installées et portée

| Composant | Copie isolée après `npm ci` | Installation active préservée |
| --- | --- | --- |
| Next.js | **16.4.5** | **16.4.3**, non actualisée |
| `@next/env` | **16.4.5** | **16.4.3** |
| SWC Linux ARM64 GNU | **16.4.5**, module natif chargé avec succès | **16.4.3** |
| React / React DOM | **19.3.1 / 19.3.1** | **19.3.1 / 19.3.1** |
| Node utilisé pour les commandes | **24.22.2** | Image et contrainte projet inchangées |
| npm utilisé | **11.19.1**, fourni avec ce Node | Aucune installation/mise à jour globale effectuée |

Environnement Codex : Debian ARM64. Node temporaire déjà disponible et vérifié lors de la phase 6.2, déplacé dans le cache ignoré pour libérer `/tmp`, avec lien symbolique conservant son chemin d’utilisation. Ni nouvelle version de Node ni modification de l’image Docker. La copie isolée utilise ses propres `node_modules` et `.next` ; les fichiers npm livrés sont identiques à ceux de cette copie après restauration de l’ordre initial du manifeste.

Empreintes comparées : **14 783 fichiers préexistants des dépendances/cache actifs**, hors caches d’outillage ignorés, identiques après vérification. Sources frontend, tests et fichiers backend relevés également inchangés. Aucun remplacement de l’installation active, redémarrage de service existant, changement UX/UI ou règle métier.

### Vérifications réellement exécutées

Toutes les commandes npm utilisent le binaire Node 24.22.2 dans le PATH. Installation, audit et validation finale ciblent exclusivement la copie isolée ; la suite de référence initiale a été exécutée depuis le frontend existant. Les paramètres de cache npm désignent un cache d’outillage ignoré du projet. Les commandes ci-dessous omettent ce chemin long et les redirections de logs, sans omettre de changement fonctionnel de commande.

| Vérification | Résultat réel |
| --- | --- |
| Référence `npm test` avant modification | **110 tests réussis / 7 fichiers**, 4,26 s |
| `npm install --save-exact next@16.4.5 --no-audit --no-fund` | **Réussi**, 135 paquets installés, 38 s, après autorisation réseau |
| `npm ci --no-audit --no-fund` | **Réussi**, 135 paquets installés, 13 s ; installation recréée à partir du verrou |
| `npm ls next react react-dom @next/env @next/swc-linux-arm64-gnu` | **Réussi**, versions de la copie ci-dessus, React dédupliqué |
| Chargement `require('@next/swc-linux-arm64-gnu')` | **Réussi**, version 16.4.5 |
| Contrôle des sept plages et du verrou | **Réussi**, sept avis exclus de la cible ; aucun changement transitif hors périmètre |
| `npm audit --json`, incluant dev et production | **Réussi, code 0 : 0 vulnérabilité**, toutes sévérités à zéro ; 232 dépendances dans les métadonnées d’audit |
| `npm run typecheck` | **Réussi**, génération des routes puis `tsc --noEmit` |
| `npm test` après mise à jour | **110 tests réussis / 7 fichiers**, 3,40 s ; aucun scénario ou test applicatif modifié |
| `NEXT_TELEMETRY_DISABLED=1 BACKEND_INTERNAL_URL=http://127.0.0.1:18762 npm run build` | **Bloqué**, code 1 en sandbox puis après autorisation : erreur Turbopack détaillée ci-dessous |
| Même build avec `-- --webpack`, contrôle complémentaire | **Réussi**, compilation 3,5 s, types et cinq pages statiques ; aucun changement de configuration |
| Recette Chromium sur assets du build Webpack | **24 cas réussis**, API intégralement simulée, zéro requête échappant aux mocks et zéro erreur JavaScript de page |
| `next start` isolé, upstream local simulé | **10 contrôles HTTP réussis**, détaillés ci-dessous |
| `next dev` isolé, contrôle supplémentaire | Serveur prêt mais **GET `/` interrompu après 15 s d’attente** pendant la première compilation ; parcours dev non validé |

**Vulnérabilités résiduelles signalées par npm audit : aucune à l’instant du contrôle.** Cela couvre les paquets examinés par son flux à ce moment, sans garantie universelle d’absence de vulnérabilité, et sans correction de l’installation active préservée. Aucune nouvelle vulnérabilité applicable à 16.4.5 n’a été identifiée dans les sources officielles consultées. Les divergences entre flux déjà documentées dans le plan restent applicables.

#### Turbopack : réserve bloquante conservée

Les deux tentatives renvoient la même erreur :

```text
Error [TurbopackInternalError]: Failed to write app endpoint /page
Caused by:
- [project]/src/app/globals.css [app-client] (css)
- creating new process
- binding to a port
- Operation not permitted (os error 1)
```

Aucune configuration Next.js, Compose ou CSS modifiée pour contourner cette restriction. Le build Webpack complémentaire fournit les assets de recette ; **le build Turbopack reste non validé pour SEC-01**. L’absence de `SecurityFatalError` est constatée sur les logs, mais ne transforme pas ce blocage en build réussi. À réexécuter dans l’environnement habituel avant validation complète.

#### Recette navigateur et contrôles HTTP

Playwright **1.65.0**, Chromium Headless Shell **158.0.8127.18**, outils déjà disponibles, aucune dépendance projet ajoutée. Les assets du build corrigé Webpack sont servis par interception sur un domaine fictif ; toutes les recherches sont simulées et les autres destinations externes bloquées.

Les 24 cas couvrent : erreurs réseau puis reprise différée et solde périmé, mise à jour du solde seulement sur réponse valide, focus restauré ou conservé vers le tri, zéro examiné, tout filtré, omissions, solde nul, plafond nul, grand entier exact, erreur de quota bloquante, consentement, pages légales, filtres avancés repliés avec cinq champs et grand seuil exact `9007199254740993`, dates UTC inclusives, conservation de l’instantané soumis pour la continuation malgré une modification de champ, quatre indicateurs exacts, deux pages maximum et déduplication. Cas principaux à **375 × 900** et **1440 × 900** ; reflow complémentaire à 320 et 768 px, sans débordement. Le tri reste local, sans appel supplémentaire.

Pour le contrôle serveur complémentaire, Next est lancé uniquement sur loopback dans la copie isolée, avec un upstream HTTP entièrement simulé ; l’adresse de cet upstream est fournie par variable d’environnement dès le build, sans changement de configuration. Dix réponses vérifiées sous `next start` :

- `/`, `/conditions`, `/confidentialite` et PNG public : **200**.
- `/api/health` simulé via rewrite : **200** ; erreur de plafond simulée via rewrite : **429** et code attendu.
- `/_next/image` sur le PNG local : **200**, contrôle légitime de l’optimiseur.
- Même endpoint sur SVG local simulé et SVG simulé annoncé comme AVIF : **400** dans les deux cas, SVG détecté puis refusé.
- Même endpoint sur URL absolue loopback non autorisée : **400** ; aucune requête correspondante transmise à l’upstream.

Ces contrôles de refus ne revendiquent pas une reproduction complète de l’exploit SVG officiel. Aucun appel de recherche backend ou YouTube réel pendant ces contrôles ; l’upstream ne reçoit que santé, erreur fictive et deux fixtures d’image. Les processus temporaires ont été arrêtés. Le passage global du script termine en échec sur son contrôle supplémentaire `next dev` : les dix contrôles production réussis sont conservés comme résultats partiels, sans déclarer la recette serveur entière réussie.

### Incidents et limites de vérification

- DNS npm refusé en sandbox (`EAI_AGAIN`) pour l’installation et l’audit ; mêmes opérations réussies après autorisation. Premier audit sans cache explicite : journal npm non inscriptible sous `~/.npm`, puis cache temporaire explicite utilisé. Aucune correction automatique.
- Une commande de restauration de l’ordre du manifeste a d’abord ciblé un chemin relatif erroné depuis la copie (`FileNotFoundError: frontend/package.json`) ; corrigée avec chemins absolus, sans modification de source ni de dépendance supplémentaire.
- Chromium bloqué en sandbox par `shutdown: Operation not permitted` ; recette autorisée hors sandbox. Premier passage interrompu par un sélecteur du script trop échappé ; correction du script uniquement, passage final de 24 cas réussi.
- Serveur HTTP de test refusé en sandbox (`listen EPERM 127.0.0.1:18762`), puis contrôles production possibles après autorisation. Le premier passage se termine sur un timeout ; un passage diagnostique identifie **GET `/` du mode dev** comme étape en attente, après les dix contrôles production réussis. Pas d’attribution certaine de ce timeout à une régression Next ; sortie dev limitée à `Compiling / ...`, puis arrêt du processus. Aucun `SecurityFatalError` observé.
- Pas de validation Docker/Compose, x64/macOS/Windows, Safari, mobile physique, lecteur d’écran ou zoom natif supplémentaire. Les huit SWC sont conservés dans le verrou, mais seul ARM64 GNU est chargé ici. Aucun test backend requis ou relancé pour ce changement sans modification backend.

### Fichiers réellement modifiés

- `frontend/package.json` : seule version Next changée.
- `frontend/package-lock.json` : dix paquets Next associés et référence racine, toutes les autres résolutions conservées.
- `docs/versions.json` : Next 16.4.5 et date ponctuelle `npm_verified_at.next: 2026-11-16` ; `verified_at` global et digests d’images conservés, sans prétendre les revérifier.
- `docs/validation.md` : résultats SEC-01 et réserves.
- `README.md` : références de version/verrou et distinction avec l’installation active ; correction demandée par la revue documentaire, pas de changement du mode de lancement.
- Ce rapport : plan conservé, décisions et présent bilan ajoutés.

Sources/tests frontend, backend, Compose et images inchangés. Aucun changement fonctionnel UX/UI ni nouveau score. Aucun commit Git, modification de main, suppression de volume, accès ou déploiement OVH.

### Preuves conservées et recette utilisateur restante

Logs et contrôles importés via le stockage persistant du skill, hors dépôt :

- [Audit npm JSON](/home/debian/.codex/state/plugins/codex-security/scans/YouFinder/artifacts-41aa9fb7e3f70ee217a50b74fccba5b26dfd9f5b712e90ebf3ac357cfd03bab4/artifacts/sec01/npm-audit.json).
- [Contrôle des sept avis et du verrou](/home/debian/.codex/state/plugins/codex-security/scans/YouFinder/artifacts-41aa9fb7e3f70ee217a50b74fccba5b26dfd9f5b712e90ebf3ac357cfd03bab4/artifacts/sec01/security-version-checks.json).
- [Build Turbopack après autorisation](/home/debian/.codex/state/plugins/codex-security/scans/YouFinder/artifacts-41aa9fb7e3f70ee217a50b74fccba5b26dfd9f5b712e90ebf3ac357cfd03bab4/artifacts/sec01/turbopack-build-authorized.log).
- [Résultats navigateur](/home/debian/.codex/state/plugins/codex-security/scans/YouFinder/artifacts-41aa9fb7e3f70ee217a50b74fccba5b26dfd9f5b712e90ebf3ac357cfd03bab4/artifacts/sec01/browser-evidence/recipe.json).
- [Contrôles serveur partiels](/home/debian/.codex/state/plugins/codex-security/scans/YouFinder/artifacts-41aa9fb7e3f70ee217a50b74fccba5b26dfd9f5b712e90ebf3ac357cfd03bab4/artifacts/sec01/runtime-partial.json).

Le même dossier contient le diff structurel du verrou, les tests frontend, le build Webpack, les logs runtime et les scripts de recette. Aucun arbre de dépendances ou build volumineux retenu comme preuve persistante.

**Recette utilisateur attendue avant tout commit :** actualiser les dépendances de l’environnement habituel selon sa procédure autorisée, sans supprimer de volume, puis vérifier les versions réellement exécutées (`npm ls next @next/env react react-dom`) et l’absence du message de sécurité ; relancer tests, typecheck et surtout build Turbopack dans Compose. Vérifier recherche simulée, filtres, quatre indicateurs, consentement, deux pages, tri, doublons, erreurs et focus. Les contrôles dev réels restent à confirmer. Aucun résultat Docker n’est déclaré confirmé par l’utilisateur pour SEC-01 à ce stade.

Le correctif de version est prêt à la recette, **SEC-01 reste ouvert pour la validation complète et l’actualisation de l’environnement actif**. Le plan de rollback reste disponible ci-dessus ; aucun rollback ni commit lancé automatiquement.

Contrôles finaux : `git diff --check` réussi ; nouveau rapport vérifié avec `git diff --no-index --check /dev/null docs/codex-reports/security-nextjs-2026-11.md`, sans diagnostic de whitespace (code 1 attendu pour un fichier nouveau). Le plan original est un préfixe byte à byte du rapport complété. Branche finale conforme ; seulement les six fichiers documentés apparaissent dans l’état Git. Empreintes actives et sources comparées de nouveau après les contrôles runtime, inchangées. Le diff exact des dépendances est conservé dans `artifacts/sec01/dependency.diff` du même stockage persistant.


## Clôture documentaire SEC-01 — 16 novembre 2026

**Clôture documentaire effectuée avec réserves : installation Next.js 16.4.5 dans Docker Compose et build de production Turbopack confirmés par l’utilisateur.** Le plan initial, le bilan Codex, les incidents et les preuves restent conservés. Les mentions antérieures de build non validé, d’installation active en 16.4.3 et de confirmations Docker en attente décrivent l’état au bilan Codex ; elles sont complétées par le présent retour, sans réécrire les résultats historiques.

### Validations Docker explicitement confirmées par l’utilisateur

| Contrôle | Résultat rapporté |
| --- | --- |
| Version installée dans Docker Compose | **Next.js 16.4.5** |
| Versions React / React DOM | **19.3.1 / 19.3.1 conservées** |
| Build de production | **Next.js 16.4.5 avec Turbopack réussi**, dans un conteneur Docker temporaire |
| Compilation TypeScript intégrée au build | **Réussie** |
| Génération des pages | **5 pages générées avec succès** |
| Avertissement de sécurité pendant ce build | **Aucun `SecurityFatalError` observé** |

Il s’agit d’un retour utilisateur, distinct d’une exécution ou d’une vérification directe de sortie par Codex. Aucune commande exacte, durée ou autre détail non fourni n’est reconstitué. La compilation TypeScript du build ne constitue pas une confirmation d’exécution séparée de `npm run typecheck`.

**Tests frontend et `npm run typecheck` exécutés séparément dans Docker : résultats non confirmés dans ce retour.** Aucun succès ni nombre de tests Docker SEC-01 n’est donc ajouté. Aucun nouvel audit npm Docker n’est confirmé non plus.

### Distinction avec les vérifications Codex

Les résultats Codex restent ceux déjà consignés : 110 tests frontend réussis avant et après modification dans 7 fichiers, typecheck réussi, installation isolée reproductible, audit npm sans vulnérabilité signalée à la date du contrôle, build Webpack complémentaire réussi, 24 cas Chromium simulés et dix contrôles HTTP production réussis avant le timeout dev.

Les **deux échecs Turbopack dans Codex**, en sandbox puis après autorisation (`binding to a port` → `Operation not permitted (os error 1)`), restent dans l’historique. Le build Docker confirmé complète la validation du build pour SEC-01 ; il ne transforme pas ces exécutions Codex en réussites. Aucun test, audit, build ou navigateur n’a été relancé par Codex pour cette clôture.

L’installation Docker Compose est désormais confirmée en 16.4.5 : la réserve d’actualisation de cet environnement est levée sur la base de ce retour. Aucune mise à jour des `node_modules` de l’hôte ou d’autres installations n’est déduite ; aucune dépendance n’est modifiée par cette intervention documentaire.

### Réserves maintenues

- Tests frontend et typecheck autonome dans Docker : non confirmés, à distinguer des résultats Codex et de la compilation TypeScript du build.
- Démarrage et première compilation sous `next dev` : timeout Codex conservé ; pas de nouvelle confirmation fonctionnelle en mode dev.
- Recette fonctionnelle SEC-01 de recherche, filtres, indicateurs, consentement, pagination, déduplication, tri, erreurs et focus : aucune confirmation utilisateur supplémentaire fournie. Les preuves Codex simulées et la recette de phase 6.2 restent distinctes.
- Mobile physique, Safari, lecteur d’écran, zoom natif et plateformes natives autres qu’ARM64 GNU : pas de validation supplémentaire fournie.
- Aucun audit de production/OVH ou test d’exploitation complet des sept avis. L’absence de `SecurityFatalError` et la réussite du build ne garantissent pas l’absence générale de vulnérabilités ; le résultat npm audit reste daté et limité aux flux consultés.

### Périmètre de la clôture

Seuls ce rapport et `docs/validation.md` sont complétés, sur `fix/nextjs-security-2026-11`. Les changements préexistants sont conservés. Aucun code applicatif, test ou dépendance modifié ; aucun service redémarré, appel YouTube lancé, volume supprimé, commit créé, accès ou déploiement OVH effectué. Cette clôture documentaire ne constitue pas une autorisation de commit ou de déploiement.
