# Build GitHub Actions → déploiement Dokploy

GitHub Actions (`.github/workflows/docker.yml`) construit les images `app` et `migrate`, les pousse sur ghcr.io ; Dokploy ne fait que les tirer (`docker-compose.registry.yml`).

| Branche | Tag | Migrations |
|---|---|---|
| `main` | `:main` | `migrator` (prod, sans démo) |
| `test` | `:test` | `seeder` (migrations + données de démo) |

## À configurer à la main

1. Après le premier run, rendre les packages `app` et `migrate` accessibles (GitHub → Packages), ou les garder privés et faire `docker login ghcr.io` sur le serveur avec un PAT `read:packages`.
2. Optionnel : variable de dépôt `PEERTUBE_HOSTS` ; secrets `DOKPLOY_WEBHOOK_MAIN` / `DOKPLOY_WEBHOOK_TEST` pour redéployer automatiquement.
3. Dokploy, par environnement : source Compose, chemin `docker-compose.registry.yml`, variables `REGISTRY_IMAGE` (`ghcr.io/<utilisateur>/<repo>`, minuscules) et `IMAGE_TAG` (`main` ou `test`), plus celles de `docker-compose.yml`.
