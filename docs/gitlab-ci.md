# Build GitLab CI → déploiement Dokploy

Le serveur Dokploy ne compile plus : GitLab CI construit les images (`app`, `migrate`), les pousse dans son registry, Dokploy les tire.

| Branche | Tag | Migrations |
|---|---|---|
| `main` | `:main` | `migrator` (prod, sans démo) |
| `test` | `:test` | `seeder` (migrations + données de démo) |

## À configurer à la main

1. **Miroir GitLab** : GitLab → projet → Settings → Repository → *Mirroring* (pull depuis GitHub) pour `main` et `test`, ou pousser vers un remote `gitlab`.
2. **Variables CI/CD** (optionnelles) : `PEERTUBE_HOSTS` (même valeur que dans Dokploy), `DOKPLOY_WEBHOOK_MAIN` / `DOKPLOY_WEBHOOK_TEST` (URL de webhook de déploiement de chaque application Dokploy).
3. **Jeton de déploiement GitLab** (Settings → Repository → Deploy tokens, scope `read_registry`), puis `docker login registry.gitlab.com` sur le serveur (ou Dokploy → Registry).
4. **Dokploy**, pour chaque environnement : source Compose, chemin `docker-compose.registry.yml`, variables `REGISTRY_IMAGE` (`registry.gitlab.com/<groupe>/<projet>`) et `IMAGE_TAG` (`main` ou `test`), plus celles de `docker-compose.yml`.
5. Runner GitLab en mode privilégié (runners partagés gitlab.com : OK) pour docker-in-docker.
