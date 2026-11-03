# AGENTS.md — YouTube Niche Explorer

## Objectif

Développer une application web personnelle de recherche et d'analyse de vidéos YouTube à partir de la YouTube Data API v3.

Le projet est également un support pédagogique pour apprendre Python, FastAPI, TypeScript, React, PostgreSQL, Docker Compose et Ansible.

## Stack

- Frontend : Next.js, TypeScript, Tailwind CSS
- Backend : Python, FastAPI
- Base de données : PostgreSQL
- Tests : pytest et tests frontend adaptés
- Développement : Docker Compose
- Production : VPS OVH, Docker Compose v2 et Ansible

## Règles de développement

- Travailler par petites fonctionnalités indépendantes.
- Présenter un plan avant les changements importants.
- Ne pas ajouter de dépendances sans justification.
- Écrire des tests pour la logique métier.
- Expliquer les décisions techniques importantes.
- Ne jamais inventer un résultat de test.
- Ne pas modifier des services existants sans autorisation.
- Demander une validation avant les opérations destructives.

## Sécurité

- Ne jamais mettre de clé API ou de mot de passe dans Git.
- Utiliser des variables d'environnement ou des secrets.
- Garder la clé YouTube exclusivement côté backend.
- Ne pas exposer PostgreSQL publiquement.
- Utiliser des images Docker à version explicite et vérifiée.
- Ne jamais supprimer un volume Docker existant.
- Ne pas effectuer de déploiement en production sans validation.

## YouTube API

- Utiliser uniquement les endpoints officiels.
- Respecter les limites de quota et les règles de conservation.
- Ne pas inventer de données YouTube manquantes.
- Distinguer les données réelles des données simulées.
- Ne pas implémenter de métriques dérivées sans vérification de conformité.
- Ne pas télécharger de contenu audiovisuel YouTube.

## Méthode de travail

1. Examiner le code existant.
2. Proposer un plan limité à la tâche demandée.
3. Implémenter.
4. Exécuter les tests disponibles.
5. Présenter le résultat et les fichiers modifiés.
6. Signaler les risques et les limites.
7. Attendre ma validation avant les changements majeurs.

## Documentation

Maintenir le README et les documents techniques à jour.

Documenter les décisions d'architecture et les incidents réutilisables dans Obsidian.
