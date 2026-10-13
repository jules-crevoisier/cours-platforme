# Build GitHub Actions → déploiement Dokploy

`.github/workflows/docker.yml` construit `app` et `migrate` à chaque push sur `main` / `test` et les publie sur ghcr.io (aucun secret ni variable à créer : le jeton GitHub intégré suffit). Dokploy ne fait que tirer les images.

| Branche | Compose Dokploy | Images | Migrations |
|---|---|---|---|
| `main` | `docker-compose.registry.yml` | `:main` | `migrator` (sans démo) |
| `test` | `docker-compose.registry.test.yml` | `:test` | `seeder` (avec démo) |

## Côté Dokploy (une seule fois)
- Changer le *Compose path* de chaque application vers le fichier ci-dessus.
- Le serveur doit pouvoir lire ghcr.io : soit rendre les packages publics (GitHub → Packages → réglages), soit `docker login ghcr.io` avec un PAT `read:packages`.

Optionnel : secrets `DOKPLOY_WEBHOOK_MAIN` / `DOKPLOY_WEBHOOK_TEST` pour redéployer automatiquement ; variable `PEERTUBE_HOSTS` si utilisée.
