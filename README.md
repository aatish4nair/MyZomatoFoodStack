# My Zomato Food Stack

A personal web app that turns my Zomato order history into a playful, searchable pile of food
illustrations. Type a food, pick a month, and see how many times you ordered it, what you paid,
where from and when.

> **Status: Phase 2 (Google Sheets data), awaiting review.** The page, animation and search
> (Phase 1) now read **real orders** from the backend, which reads the Google Sheet with a read-only
> service account. By default it runs **only on your computer** (the backend binds to `127.0.0.1` and
> answers only to `localhost`). It can also be configured for a **public deployment on Render**, where
> the order history is intentionally public, with no login: see
> [docs/deployment/RENDER.md](docs/deployment/RENDER.md). **Dish images:** most dishes show a food
> photo matched by dish name (some photos are shared between similar dishes, such as combos and
> variants, and sizes and quality vary); the rest intentionally show a cartoon stand-in from My
> Food Pile, and the falling footer pile uses those cartoon sprites. `npm run art:coverage` reports
> the current coverage. Connect your sheet with
> [docs/development/GOOGLE-SHEETS-SETUP.md](docs/development/GOOGLE-SHEETS-SETUP.md).

The food illustrations and physics approach come from
[My Food Pile](https://github.com/sumitbedi/my-food-pile) by Sumit Bedi (MIT). See
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). This is a personal project and is not affiliated
with or endorsed by Zomato.

## How it fits together

```
Gmail ──▶ Apps Script (existing) ──▶ Google Sheet ──▶ backend (Fastify) ──▶ frontend (React)
                                     "Formatted Data"   holds credentials     only calls /api
```

| Folder      | What it is                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------- |
| `frontend/` | React + Vite + TypeScript UI. Runs in the browser. Never holds credentials or bundled order data. |
| `backend/`  | Fastify + TypeScript API. The only part allowed to read the spreadsheet (from Phase 2).           |
| `shared/`   | Types and Zod runtime schemas used by both sides (the "contract").                                |
| `docs/`     | Architecture, security, development and product documentation.                                    |

More detail: [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md).

## Prerequisites

- **Node.js 24 or newer** (CI uses Node 24 LTS, from `.nvmrc`). Check with `node --version`.
- **npm 10.9 or newer** (ships with Node). Check with `npm --version`.
- Git.

## Installation

```bash
npm ci            # installs exactly what package-lock.json specifies
cp backend/.env.example backend/.env   # optional; the defaults work for local development
```

## Development

Run the backend and frontend in **two terminals**:

```bash
npm run dev:backend    # API on http://127.0.0.1:3000  (try /api/health)
npm run dev:frontend   # UI  on http://127.0.0.1:5173  (forwards /api to the backend)
```

- `npm run sheet:check`: tests the Google Sheets connection and prints the sheet's structure (no
  personal data).
- `npm run dev:demo`: frontend only, with synthetic demo orders (no backend or Google needed).

## Checks and tests

| Command                | What it does                                                        |
| ---------------------- | ------------------------------------------------------------------- |
| `npm test`             | Runs all unit/integration tests (Vitest) for every package          |
| `npm run test:watch`   | Re-runs tests as you edit                                           |
| `npm run lint`         | ESLint, including the import-boundary rules                         |
| `npm run typecheck`    | Strict TypeScript checks for every package                          |
| `npm run format:check` | Verifies Prettier formatting (`npm run format` fixes it)            |
| `npm run build`        | Production build of shared, backend and frontend                    |
| `npm run audit:deps`   | Fails on known high/critical vulnerabilities in dependencies        |
| `npm run check`        | Format + lint + typecheck + test + build, in the same order CI uses |

Full guide: [docs/development/DEVELOPMENT.md](docs/development/DEVELOPMENT.md).
Security: [SECURITY.md](SECURITY.md) and [docs/security/SECURITY-MODEL.md](docs/security/SECURITY-MODEL.md).
