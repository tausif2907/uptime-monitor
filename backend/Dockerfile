# Worker image for Railway / Render / Fly.io.
# Build from the REPO ROOT:  docker build -f backend/Dockerfile -t uptime-worker .

FROM node:22-slim AS base
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@9.15.9
WORKDIR /app

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/database/package.json packages/database/
COPY packages/shared/package.json packages/shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
# Prisma schema must exist before install (postinstall runs `prisma generate`).
COPY packages/database/prisma packages/database/prisma
RUN pnpm install --frozen-lockfile --filter @uptime/backend... --filter @uptime/database
COPY packages packages
COPY backend backend
RUN pnpm --filter @uptime/backend build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/backend
EXPOSE 4000
# Migrations run as a deploy step, never by hand.
CMD ["sh", "-c", "cd ../packages/database && npx prisma migrate deploy && cd ../../backend && node dist/index.js"]
