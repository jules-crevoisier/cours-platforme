# Build GitHub Actions → déploiement Dokploy

`.github/workflows/docker.yml` construit `app` et `migrate` à chaque push sur `main` / `develop` et les publie sur ghcr.io (aucun secret ni variable à créer : le jeton GitHub intégré suffit). Dokploy ne fait que tirer les images.

| Branche | Compose Dokploy | Images | Migrations |
|---|---|---|---|
| `main` | `docker-compose.registry.yml` | `:main` | `migrator` (sans démo) |
| `develop` | `docker-compose.registry.test.yml` | `:develop` | `seeder` (avec démo) |

**Prod = `main`** (https://cours.srko.fr). `develop` sert à la recette avec données de démo. Procédure de travail : [GITFLOW.md](GITFLOW.md). Ne jamais mettre `docker-compose.yml` (qui compile sur le serveur) dans Dokploy.

## Côté Dokploy (une seule fois)
- Changer le *Compose path* de chaque application vers le fichier ci-dessus.
- Le serveur doit pouvoir lire ghcr.io : soit rendre les packages publics (GitHub → Packages → réglages), soit `docker login ghcr.io` avec un PAT `read:packages`.

Redéploiement automatique (optionnel) : secrets `DOKPLOY_URL`, `DOKPLOY_API_KEY` et `DOKPLOY_COMPOSE_ID_MAIN` / `DOKPLOY_COMPOSE_ID_TEST` (API Dokploy, recommandé), ou à défaut `DOKPLOY_WEBHOOK_MAIN` / `DOKPLOY_WEBHOOK_TEST`. Couper alors l'*Autodeploy* Dokploy pour ne pas déployer deux fois ; variable `PEERTUBE_HOSTS` si utilisée.
