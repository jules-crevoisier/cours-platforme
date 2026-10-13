# syntax=docker/dockerfile:1.7
# Image de production optimisée (Next.js standalone) — déployable sur Dokploy.

ARG NODE_VERSION=24-alpine

# ── 1. Dépendances ──────────────────────────────────────────
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
# Schéma + config nécessaires au `postinstall` (prisma generate)
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN --mount=type=cache,target=/root/.npm npm ci

# ── 2. Build ────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Les en-têtes (CSP frame-src) sont calculés au build : instances PeerTube / Esup-Pod autorisées.
# Ce n'est pas un secret. À renseigner aussi à l'exécution (variable du même nom).
ARG PEERTUBE_HOSTS=""
ENV PEERTUBE_HOSTS=${PEERTUBE_HOSTS}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Valeurs factices, uniquement pour le build (jamais présentes dans l'image finale)
RUN export DATABASE_URL="mysql://build:build@localhost:3306/build" \
           BETTER_AUTH_SECRET="build-only-placeholder-secret-not-used-at-runtime" \
    && npx prisma generate && npm run build

# ── 3. Migrations (service one-shot dans docker-compose) ────
# Uniquement la CLI Prisma, pas les dépendances de l'application
FROM node:${NODE_VERSION} AS migrator
WORKDIR /app
RUN --mount=type=cache,target=/root/.npm     npm init -y >/dev/null && npm install --no-audit --no-fund prisma@7.10.0 dotenv@18.0.3
COPY prisma.config.ts ./
COPY prisma ./prisma
USER node
CMD ["npx", "prisma", "migrate", "deploy"]

# ── 3 bis. Migrations + données de démo (déploiement `test`) ──
# Réutilise les dépendances (tsx, client Prisma généré) ; le seed est idempotent.
FROM deps AS seeder
COPY src/data ./src/data
ENV SEED_FORCE=1
USER node
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed"]

# ── 4. Runtime ──────────────────────────────────────────────
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" || exit 1
CMD ["node", "server.js"]
