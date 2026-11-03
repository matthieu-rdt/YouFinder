# Incidents réutilisables

## Installation des outils dans un environnement ARM64 à espace temporaire limité

Date : 2026-11-01.

Symptômes : le binaire Node x64 échoue avec une erreur d'exécution ; npm échoue ensuite avec `ENOSPC` dans son cache temporaire.

Diagnostic : vérifier `uname -m`, le type du binaire avec `file`, puis l'espace disponible avec `df -h`. L'environnement est ARM64 et `/tmp` dispose de moins de 1 Go, sur une partition distincte du dépôt.

Résolution : télécharger le runtime ARM64 depuis Node.js et vérifier son SHA-256 avec le fichier officiel `SHASUMS256.txt`. Supprimer uniquement les artefacts temporaires créés pour la tâche après autorisation, puis déplacer le cache npm dans `.npm-cache/`, ignoré par Git. Aucun volume Docker ni fichier préexistant n'a été supprimé.

Prévention : identifier l'architecture et l'espace disque avant de télécharger les outils. Les images Docker sont épinglées au digest multiarchitecture, plutôt qu'à celui d'une architecture particulière.

## Compilation Turbopack dans un environnement sans ouverture de ports

Le build par défaut de Next.js échoue ici avec `binding to a port: Operation not permitted` lors du traitement PostCSS, y compris après une demande d'exécution hors sandbox. Le même projet compile avec `npm run build -- --webpack`. Le compilateur par défaut reste inchangé pour le développement local. Cette vérification alternative ne valide pas Turbopack ni le proxy HTTP en fonctionnement ; ils restent à tester sur une machine équipée de Docker.

## Accès au daemon Docker refusé malgré un CLI Compose fonctionnel

Date : 2026-11-02.

Symptôme : `docker compose config --quiet` et la résolution JSON avec sentinelle fonctionnent, mais `docker compose ps --format json` renvoie un accès refusé à `/var/run/docker.sock`, même après autorisation d’exécution hors sandbox.

Diagnostic : la validation d’un fichier Compose est locale au CLI et ne prouve pas l’accès au daemon. Ce refus peut relever des droits de l’utilisateur ou des restrictions de l’environnement ; la cause exacte n’a pas été établie ici.

Contournement de validation : exécuter pytest/Vitest/TypeScript et le build Webpack avec des runtimes locaux, puis contrôler l’injection déclarative avec `scripts/check-compose-env.py`. Cela ne valide ni les images construites, ni l’environnement réel des conteneurs, ni le trajet réseau du proxy.

Aucune modification des droits du socket, des groupes système, des services existants ou des volumes n’a été effectuée. Les vérifications restantes sont consignées dans [[validation]].


## Filtrage temporel incomplet après enrichissement — 2026-11-03

Symptôme signalé : une vidéo datée du 03/11/2026 apparaissait pour la période du 01/06/2026 au 07/07/2026 inclus, avec vues minimum 10000 et durée minimum 3 minutes.

Cause locale démontrée par reproduction simulée avant correction : les bornes étaient transmises à `search.list`, mais `filters.py` ne vérifiait jamais la date de publication issue de `videos.list`, utilisée pour l’affichage. Une vidéo hors période satisfaisant vues et durée était donc retenue. Sans les échanges HTTP d’origine, la raison de la présence de cet identifiant dans le résultat initial n’est pas établie ; aucune responsabilité de Google n’est démontrée. La différence possible entre création/téléversement et publication doit rester distincte de ce constat.

Correction : contrôle final des dates enrichies avec des instants RFC 3339 normalisés en UTC, début inclus et fin exclusive au lendemain à 00:00 UTC. Les dates absentes, invalides ou sans fuseau sont exclues si une borne temporelle est active. Préservation des appels groupés, du quota, de l’ordre et du calcul des compteurs. La précédente borne frontend à 23:59:59.999 UTC est remplacée pour inclure aussi les fractions de seconde restantes de la journée ; ce défaut de précision n’expliquait pas l’écart de plusieurs mois.

Prévention : tester les résultats enrichis en simulant des dates différentes de celles de recherche, les limites de journée, les fuseaux et les compteurs. Rapport et résultats : [[codex-reports/fix-date-filter]].
