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
