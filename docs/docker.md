# Dockerization

The whole app (backend + frontend) ships as a **single image**. The Hono server serves both the
`/api/*` routes and the built React static assets — there's no separate frontend container or
reverse proxy.

## Image layout (multi-stage build)

`Dockerfile` (repo root) has four stages:

| Stage | Base | Purpose |
|---|---|---|
| `deps` | `node:22-alpine` | Installs the **full** pnpm workspace (incl. devDependencies), keyed only off `pnpm-lock.yaml` + the workspace `package.json` files, so this layer is cached until dependencies actually change. |
| `build` | from `deps` | Copies the full source and runs `pnpm --filter @upwork-chatbot/web build` (`tsc && vite build`) to produce `apps/web/dist`. |
| `prod-deps` | `node:22-alpine` | A second, independent install — `pnpm install --prod --filter "@upwork-chatbot/server..."` — pulling in **only** the server's runtime dependencies (and the `shared` workspace package it depends on). No `vite`, `typescript`, or other devDependencies end up in this stage. |
| `runtime` | `node:22-alpine` | The final image: prod `node_modules` from `prod-deps` + server/shared source (`.ts`, run directly) + `apps/web/dist` from `build`. Runs as a non-root user. |

Final image size: **~190 MB**.

### Why the server runs as TypeScript via `tsx`, not compiled JS

`packages/shared`'s `package.json` points `main` at `./src/index.ts` (raw TypeScript) so that both
`tsx watch` (server dev) and Vite (frontend dev/build) can consume it directly with no build step —
that's how local dev already worked before dockerization. Introducing a `tsc`-compiled path for the
server would have required also compiling `shared` to JS and repointing its `main`/`types`, which
would break that resolution for local dev. Instead, the image keeps the same run model as dev:
`tsx` is a production dependency (`apps/server/package.json`), and the container's `CMD` runs
`tsx src/index.ts` directly against the TypeScript source — no `dist/` for the server exists at all.
The frontend is the only piece that's actually compiled (via `vite build`), since static assets are
what a browser needs.

### Static frontend serving

[`apps/server/src/index.ts`](../apps/server/src/index.ts) uses `@hono/node-server/serve-static` with
`root: "../web/dist"` (relative to the server's working directory, which is `apps/server` in both
local dev and the container) to serve the built frontend, with a catch-all fallback to `index.html`.
In local dev this directory doesn't exist (the Vite dev server handles the frontend on `:5173`
instead), so the route simply falls through — it only becomes active once `apps/web` has been built,
which is exactly what happens in the Docker image.

## Running it

### docker compose (recommended)

```bash
docker compose up -d --build
```

This builds the image and starts it with the port mapping and restart policy already configured in
[`docker-compose.yml`](../docker-compose.yml). Open `http://localhost:8787`.

Environment variables (all optional — the app defaults to offline mock mode):

- `PORT` — host port to publish (default `8787`)
- `OPENROUTER_API_KEY` / `OPENROUTER_MODEL` — when a key is set, the header's **AI (LLM)** toggle becomes
  available; testers switch engines per request at runtime. Without a key the app runs rule-based only.

### Plain `docker`

```bash
docker build -t upwork-chatbot .
docker run -d \
  --name upwork-chatbot \
  --restart unless-stopped \
  -p 127.0.0.1:8787:8787 \
  --env-file .env \
  upwork-chatbot
```

## Design choices per requirement

- **Container IP is never exposed.** The container runs on Docker's default bridge network; only
  the published port (`-p 127.0.0.1:8787:8787` / `ports:` in compose) is reachable from the host —
  never the container's internal bridge IP, and `--network host` is not used.
- **Restart policy.** `restart: unless-stopped` in `docker-compose.yml` (equivalently
  `--restart unless-stopped` with plain `docker run`) — the container restarts automatically on crash
  or daemon restart, but stays down if you deliberately stop it.
- **Optimized image.**
  - Multi-stage build: build tooling (`vite`, `typescript`, `esbuild`, etc.) never reaches the final
    image — only the `prod-deps` install (production dependencies of the server) is copied in.
  - Layer caching: dependency manifests are copied and installed before the rest of the source, so
    `pnpm install` is only re-run when `package.json`/`pnpm-lock.yaml` actually change.
  - `node:22-alpine` base for both build and runtime stages.
  - `.dockerignore` excludes `node_modules`, `dist`, `.git`, `.env`, and docs from the build context.
  - Runs as a non-root user (`nodeapp`).
  - Built-in `HEALTHCHECK` hits `/api/health` using Node's global `fetch` — no extra `curl`/`wget`
    package installed just for that.
- **Single Dockerfile serves both apps.** The frontend is compiled to static files
  (`apps/web/dist`) and served by the same Hono process that serves `/api/*` — no separate frontend
  container, Nginx, or reverse proxy.
