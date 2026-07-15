# North Star Support Bot

A customer-support chatbot for a small outdoor-apparel / camping-gear e-commerce store. It handles order
tracking, returns & exchanges, shipping questions, and product recommendations, with a clear fallback and
human-handoff path when it can't help. Grounded data (order status, policies, shipping times) always comes
from hardcoded functions, not the model, so answers are accurate by construction. The app runs fully offline
in a deterministic **mock mode** by default — no API key, account, or subscription needed to review it — and
can optionally be pointed at a real LLM via OpenRouter.

## Reviewing this submission — no API key required

There are two independent ways to test the bot, and **neither** requires you to add a key, buy anything, or
create an account:

1. **Clone and run locally (rule-based brain).** `pnpm install && pnpm dev`, open `http://localhost:5173`.
   With no key set, the app runs its deterministic engine, which covers every required use case on its own.
2. **Hosted demo (AI brain).** A live instance is deployed with a server-side OpenRouter key already
   configured, so you can exercise the full LLM experience without supplying one: **`<LIVE_DEMO_URL>`**.

The two brains share one conversation flow engine, so business rules (exact order statuses, policy text,
handoff, return-to-menu) behave identically either way — the LLM just makes intent/entity recognition more
forgiving of phrasing.

## Prerequisites

- Node.js >= 22
- pnpm (`corepack enable` will pick up the pinned version, or `npm i -g pnpm`)

## Run it

```bash
pnpm install
pnpm dev
```

This starts the backend (Hono, `http://localhost:8787`) and frontend (Vite, `http://localhost:5173`)
concurrently. Open `http://localhost:5173` in a browser and start chatting. No `.env` file is required —
with no `OPENROUTER_API_KEY` set, the app automatically runs in mock mode (deterministic keyword-based intent
matching, zero network calls).

## Try each use case

| Use case | Try saying |
|---|---|
| Order tracking | "where is my order", then `#111` / `#222` / `#333` / any other number |
| Returns & exchanges | "how do I return this", "refund", "exchange" |
| Shipping info | "how long is shipping", "when will it arrive" |
| Product recommendations | "recommend something", "I need gear for camping" (then answer the 1–2 follow-up questions) |
| Fallback | anything unrelated, e.g. "do you sell cars" |
| Human handoff | "talk to a live agent", or send two unrelated messages in a row to trigger auto-escalation |

From the simulated live-agent chat, type `menu` to return to the bot's main menu at any time.

See [docs/test-plan.md](docs/test-plan.md) for the full manual test script with expected outputs, including
the exact order-tracking responses.

## Switching engines (toggle at the top of the page)

The header has a **Rule-based / AI (LLM)** toggle, so a tester can evaluate both scenarios in the same
session without restarting anything — the choice is sent per request.

- **Rule-based** — the deterministic keyword/regex matcher plus regex slot extraction. Always available,
  fully offline, no key.
- **AI (LLM)** — one structured `generateObject` call (Vercel AI SDK) that returns the intent **and** any
  slots in the same message (order number, recommendation activity/temperature), so phrasings like "track the
  one ending in 222" or "hiking gear for cold weather" resolve in a single turn. On any error it falls back
  to the rule-based path automatically.

The **AI (LLM)** option is only enabled when the server has an OpenRouter key configured (the client learns
this from `GET /api/config`). Without a key it stays disabled and the app runs rule-based only, so a fresh
clone is testable with zero setup. To enable AI mode, copy `.env.example` to `apps/server/.env` and set:

```bash
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=anthropic/claude-sonnet-5   # or any OpenRouter-hosted model
```

Grounded data (order status, policies, shipping times) is unaffected by the toggle — it always comes from
the same hardcoded functions either way.

## Production deployment

The app is deployed to a single VPS as a **one-node Docker Swarm stack**, provisioned and updated via
Ansible — no container registry, no Docker Hub push/pull. Everything is driven from
[`infrastructure/`](infrastructure):

```bash
cd infrastructure
ansible-playbook -i inventory/hosts.yml playbook.yml --ask-vault-pass
```

- **No registry.** The `chatbot` role rsyncs the repo straight to the node and runs `docker build` there
  (see [`roles/chatbot/tasks/main.yml`](infrastructure/roles/chatbot/tasks/main.yml)), so the image only
  ever needs to exist in that single node's local image cache — nothing is pushed or pulled from
  anywhere.
- **Swarm, single node.** `docker stack deploy` reconciles the `northstar-backend` service declared in
  [`docker-compose.yml.j2`](infrastructure/roles/chatbot/templates/docker-compose.yml.j2)
  (templated per-run, not hand-edited). The port is published with `mode: host` rather than the default
  ingress routing mesh, and updates run `order: stop-first` — both are required for a single-node swarm,
  where there's no second node to stage a replacement task on while the old one still holds the port.
- **Secrets via Ansible Vault.** `OPENROUTER_API_KEY` / `OPENROUTER_MODEL` live in an encrypted
  `inventory/group_vars/chatbot/vault.yml` (create with `ansible-vault create ...`), templated into a
  `0600 .env` on the host and wired into the container via the compose file's `env_file:`. Omit the vault
  file entirely and the app just runs rule-based-only in production, same as local dev.
- **TLS.** The `nginx` + `certbot` roles reverse-proxy the published port and obtain/renew a Let's Encrypt
  cert. `certbot --nginx` re-runs on every playbook run (needed because the nginx vhost is re-templated
  from scratch each time) but only actually contacts Let's Encrypt's issuance endpoint when the cert is
  within its renewal window — safe to run as often as you deploy without hitting rate limits.

## Project structure

```
apps/
├─ web/            # React + Vite frontend (QuickReplies chips, live-agent inbox at /agent)
└─ server/         # Hono + Vercel AI SDK backend
│  └─ src/
│     ├─ router.ts        # understand(): intent + slot extraction (LLM or deterministic)
│     ├─ conversation.ts  # pure, unit-tested conversation state machine
│     └─ handlers/        # one grounded reply per use case
packages/
└─ shared/         # types, seed data, intent enum, prompt fragments
infrastructure/     # Ansible: provisions the VPS and deploys the app as a single-node Docker Swarm stack
docs/
├─ test-plan.md          # manual test script with expected outputs
├─ demo-script.md        # 2–3 min video walkthrough (all 4 use cases + fallback)
├─ submission-checklist.md # requirement-by-requirement sign-off
├─ live-agent.md         # live human-agent slice design
└─ docker.md             # Dockerization: image layout, running, design choices
```

## Other scripts

- `pnpm build` — build all workspaces
- `pnpm typecheck` — typecheck all workspaces
- `pnpm test` — run the automated test suite (Vitest) covering intent classification, order lookup, gear
  recommendations, and handoff/return-to-menu logic
