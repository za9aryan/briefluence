# One image for the website and the API (built from the monorepo). Built on the server itself,
# so it matches the Oracle ARM (aarch64) CPU.
FROM node:24-bookworm-slim

# openssl: Prisma engines. python3/make/g++: fallback if a native module (argon2) must compile.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

ENV CI=true HUSKY=0 NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

# Dependencies first (cached between deploys when only code changes).
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/ui/package.json packages/ui/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @briefluence/api prisma:generate \
  && pnpm --filter "@briefluence/api..." build

# The website forwards /api/v1 to the API container; the address is baked in at build time.
ARG API_INTERNAL_URL=http://api:4000
ENV API_INTERNAL_URL=$API_INTERNAL_URL
RUN pnpm --filter "@briefluence/web..." build

ENV NODE_ENV=production
