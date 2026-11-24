# Gitflow

| Branche | Rôle | Déploiement |
|---|---|---|
| `main` | Production, toujours livrable. Seules les releases et les hotfix y arrivent. | https://cours.srko.fr (Dokploy, `docker-compose.registry.yml`, images `:main`) |
| `develop` | Intégration : tout le travail terminé y est fusionné. | Recette avec données de démo (images `:develop`, `docker-compose.registry.test.yml`) |
| `feature/<sujet>` | Une fonctionnalité, créée depuis `develop`. | Aucun |
| `fix/<sujet>` | Correction non urgente, créée depuis `develop`. | Aucun |
| `hotfix/<sujet>` | Correction urgente de prod, créée depuis `main`. | Aucun |

## Flux
1. `feature/...` ou `fix/...` depuis `develop`, PR vers `develop` (la CI `check` : lint, types, tests doit être verte), puis suppression de la branche une fois fusionnée.
2. Release : PR `develop` vers `main`, fusion en merge commit. Le push sur `main` construit les images `:main` et redéploie la prod.
3. Hotfix : branche depuis `main`, PR vers `main`, puis PR `main` vers `develop` pour ne rien perdre.

## Règles
- Pas de commit direct sur `main` ni `develop`.
- Une branche fusionnée est supprimée (réglage GitHub « Automatically delete head branches »).
- `main` est la seule branche que Dokploy de prod suit. Ne jamais mettre `docker-compose.yml` en prod : il compile sur le serveur.
