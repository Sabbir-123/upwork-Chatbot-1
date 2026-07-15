# syntax=docker/dockerfile:1.7

# North Star Support Bot — single image serving both the Hono API and the
# built React static assets (the backend serves apps/web/dist directly).

ARG NODE_IMAGE=node:22-alpine

########################################################################
# base — shared toolchain for every build stage
########################################################################
FROM ${NODE_IMAGE} AS base
RUN corepack enable && pnpm config set store-dir /pnpm-store
WORKDIR /app

########################################################################
# deps — install the full workspace (incl. devDependencies) so the
# frontend can be built. Isolated in its own layer, keyed off the
# lockfile + manifests only, so it's cached until dependencies change.
########################################################################
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    pnpm install --frozen-lockfile

########################################################################
# build — compile the React app into static assets (apps/web/dist).
# The server itself ships as TypeScript source, run via tsx (see the
# "start" script) — this project has no compiled server output, so
# there is nothing to build for it.
########################################################################
FROM deps AS build
COPY . .
RUN pnpm --filter @upwork-chatbot/web build

########################################################################
# prod-deps — production-only node_modules for the server (and the
# shared workspace package it depends on). No vite/typescript/etc.
########################################################################
FROM base AS prod-deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/server/package.json apps/server/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    pnpm install --frozen-lockfile --prod --filter "@upwork-chatbot/server..." \
    && mkdir -p node_modules apps/server/node_modules packages/shared/node_modules

########################################################################
# runtime — minimal final image: node + prod deps + source + static assets.
########################################################################
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    MOCK_LLM=true \
    PORT=8787
WORKDIR /app

RUN addgroup -S nodeapp && adduser -S nodeapp -G nodeapp

COPY --from=prod-deps --chown=nodeapp:nodeapp /app/node_modules ./node_modules
COPY --from=prod-deps --chown=nodeapp:nodeapp /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=prod-deps --chown=nodeapp:nodeapp /app/packages/shared/node_modules ./packages/shared/node_modules

COPY --chown=nodeapp:nodeapp packages/shared/package.json packages/shared/package.json
COPY --chown=nodeapp:nodeapp packages/shared/src packages/shared/src
COPY --chown=nodeapp:nodeapp apps/server/package.json apps/server/package.json
COPY --chown=nodeapp:nodeapp apps/server/src apps/server/src
COPY --from=build --chown=nodeapp:nodeapp /app/apps/web/dist ./apps/web/dist

WORKDIR /app/apps/server
USER nodeapp

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node_modules/.bin/tsx", "src/index.ts"]
