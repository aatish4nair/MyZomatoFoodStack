# Development guide

## Required tools

| Tool    | Version         | Check            | Notes                                                     |
| ------- | --------------- | ---------------- | --------------------------------------------------------- |
| Node.js | 24 LTS or newer | `node --version` | `.nvmrc` says 24; CI uses it. Newer (e.g. 26) also works. |
| npm     | 10.9 or newer   | `npm --version`  | Comes with Node.                                          |
| Git     | any recent      | `git --version`  |                                                           |

`engine-strict=true` in `.npmrc` makes `npm install` refuse to run on an older Node.

## Local setup

```bash
npm ci                                   # install exactly what the lockfile says
cp backend/.env.example backend/.env     # optional; defaults are fine locally
npm run check                            # format, lint, typecheck, test, build: everything CI runs
```

`npm ci` deletes `node_modules/` and reinstalls from `package-lock.json`. Use `npm install <pkg>`
only when you deliberately add or upgrade a dependency, then commit the updated lockfile.

To add a dependency to one package, use `-w`, for example
`npm install some-lib -w @food-stack/backend`.

## Running

```bash
# terminal 1
npm run dev:backend      # http://127.0.0.1:3000/api/health → {"status":"ok"}
# terminal 2
npm run dev:frontend     # http://127.0.0.1:5173
```

The frontend dev server forwards every `/api/...` request to the backend, so the browser talks to
one origin and no CORS changes are needed locally.

Production-style run: `npm run build`, then `npm start -w @food-stack/backend` and
`npm run preview -w @food-stack/frontend`.

## Reviewing the animation (Phase 1)

```bash
npm run dev:frontend          # http://127.0.0.1:5173
```

- **Opening drop:** refresh the page. Food falls, settles along the bottom, then the interface
  fades in.
- **Placeholder:** leave the search empty; a food name changes about every 1.8 seconds. Type and
  it pauses; clear the field and it resumes.
- **Focus (mouse/trackpad):** the search field is focused when the page appears; click the title or
  blank space, or pick a month with the mouse, and you can type straight away.
- **Search:** try `tandoori`, `chicken tandoori`, `idly`, `momos`, `pizza`, then switch months.
  `sushi` shows the no-match state.
- **Reduced motion:** turn on macOS _System Settings → Accessibility → Display → Reduce motion_
  (or Chrome DevTools → Rendering → _prefers-reduced-motion: reduce_) and refresh. The pile
  appears already settled and the placeholder stays still.
- **Responsive:** resize the window or use DevTools device mode. The pile re-settles to the new
  width.
- **Production build:** `npm run build && npm run preview -w @food-stack/frontend`
  (http://127.0.0.1:4173). This includes the strict CSP.

The data is **synthetic** (`frontend/src/services/demo-orders.ts`), and the pictures are
temporary stand-ins until the final artwork is added (`docs/design/ART-BRIEF.md`).

## Real data vs demo data

- `npm run dev:backend` + `npm run dev:frontend`: **real data** from your Google Sheet. Set it up
  with [GOOGLE-SHEETS-SETUP.md](GOOGLE-SHEETS-SETUP.md). Without it the page shows "Your orders
  couldn't be loaded" (code `NOT_CONFIGURED`). It never falls back to demo data.
- `npm run dev:demo`: frontend only, with **synthetic** orders. Good for design and animation work.
- `npm run sheet:check`: connection and structure check (no personal data printed).
- `npm run art:coverage`: which artwork your data needs; details go to the Git-ignored
  `private/art-coverage.md`.

## Commands

| Command                            | Purpose                                               |
| ---------------------------------- | ----------------------------------------------------- |
| `npm test`                         | All tests, all packages (Vitest "projects")           |
| `npm run test:watch`               | Tests in watch mode                                   |
| `npx vitest run --project backend` | Tests for one package                                 |
| `npm run lint`                     | ESLint (type-aware), including import-boundary rules  |
| `npm run typecheck`                | `tsc` for every package (no output files)             |
| `npm run format`                   | Format everything with Prettier                       |
| `npm run format:check`             | Check formatting without changing files               |
| `npm run build`                    | Build shared → backend → frontend (`dist/` folders)   |
| `npm run audit:deps`               | Fail on known high/critical vulnerabilities           |
| `npm run check`                    | Format + lint + typecheck + test + build, in CI order |

## Where tests live

Tests sit next to the code they test, as `*.test.ts(x)`:

- `shared/src/**`: pure functions and schemas.
- `backend/src/**`: the API is tested in-process with `app.inject()`, so no port or network is
  needed.
- `frontend/src/**`: React Testing Library in a simulated browser (jsdom).

Use **synthetic** data in tests. Never paste real order rows into fixtures.

## Troubleshooting

| Symptom                                                                                   | Fix                                                                                                                               |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `npm error engine Unsupported engine`                                                     | Install Node 24+ (e.g. `nvm install 24 && nvm use`).                                                                              |
| `Invalid environment configuration: - PORT: …`                                            | Fix that variable in `backend/.env`. The message names the variable but not its value, by design.                                 |
| `EADDRINUSE` on port 3000 or 5173                                                         | Another process uses the port: `lsof -i :3000`, or set `PORT=` in `backend/.env`.                                                 |
| Frontend shows network errors for `/api`                                                  | Start the backend (`npm run dev:backend`) first.                                                                                  |
| `Cannot find module '@food-stack/shared'` when running `npm start -w @food-stack/backend` | Run `npm run build` first. The production backend uses `shared/dist`.                                                             |
| Prettier check fails in CI                                                                | Run `npm run format` locally and commit the result.                                                                               |
| A new dependency fails because its install script didn't run                              | Install scripts are disabled (`ignore-scripts=true`). Check whether it truly needs one, then decide case by case and document it. |
