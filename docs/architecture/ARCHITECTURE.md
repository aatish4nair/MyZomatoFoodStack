# Architecture

Status markers: **[built]** exists and is tested · **[planned]** designed here, not built yet.

## 1. System boundaries

```
 ┌──────────── Google (private to the owner) ────────────┐
 │  Gmail ──▶ Apps Script (existing, unchanged) ──▶ Sheet │
 │                          "My Zomato Food Pile" / "Formatted Data"
 └──────────────────────────────┬─────────────────────────┘
                                │ Google Sheets API, read-only, service account   [planned]
                ════════════════╪═══════════ trust boundary: server side ═══════════
                                ▼
                      backend/ (Fastify, Node)                                    [built: shell]
                      validates, filters, aggregates
                                │ HTTPS JSON under /api, validated by shared schemas
                ════════════════╪═══════════ trust boundary: the internet/browser ══
                                ▼
                      frontend/ (React, static files in the browser)              [built: shell]
```

- The **browser is untrusted**. It never receives Google credentials, the spreadsheet ID, Gmail
  message IDs, or the full dataset by default.
- The **backend is the only component that talks to Google**.
- The existing **Apps Script import stays exactly as it is**. This project only reads the sheet.

## 2. Module responsibilities

| Module      | Responsibility                                                                                                                                            | Must not                                          |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `shared/`   | Zod schemas + inferred TypeScript types (`OrderLine`, `MonthFilter`, `SearchSummary`, `HealthResponse`, `ApiError`), pure helpers such as `toDisplayName` | Import from `frontend` or `backend`; do I/O       |
| `backend/`  | Config validation, HTTP security (headers, CORS, rate limit), error handling, API routes, Google Sheets integration                                       | Import from `frontend`; log personal data         |
| `frontend/` | Rendering, animation, user interaction; calls the API over HTTP                                                                                           | Import from `backend`; hold secrets or data files |

### Backend layout (current)

```
backend/src/
├── server.ts                 starts the process (reads env, listens, graceful shutdown)
├── app.ts                    buildApp(env): registers plugins and routes; used by tests
├── config/env.ts             Zod-validated environment variables
├── lib/logger.ts             logging rules (method + path only, redaction)
├── middleware/error-handler  uniform, safe JSON errors
└── modules/health/           GET /api/health
```

Planned additions: `modules/orders/`, `modules/insights/`, `integrations/google-sheets/`. They're
created when they get real code, not before.

### Frontend layout (current)

```
frontend/src/
├── main.tsx                     entry point (loads the self-hosted Outfit font)
├── app/App.tsx                  page composition: data → month/search state → result, plate, pile
├── components/MonthSelect.tsx   month pill (a native <select>)
├── features/
│   ├── food-art/registry.ts     the ONLY map from food category → image file (pile + plate)
│   ├── food-stack/              the falling pile
│   │   ├── pile-layout.ts         pure sizing/selection maths (responsive item size + count)
│   │   ├── sprite-shape.ts        crop + convex outline tracing of each picture
│   │   ├── pile-simulation.ts     Matter.js world: walls, bodies, stepping, settling, final layout
│   │   ├── pile-renderer.ts       draws positions onto the canvas (no shadows or effects)
│   │   ├── usePileAnimation.ts    React lifecycle: run once → freeze → clean up
│   │   └── FoodPile.tsx           the footer element + canvas
│   └── search/                  SearchField, useRotatingPlaceholder, SearchResult, Plate, icons, format
├── hooks/                       useOrders (loading/failure), usePrefersReducedMotion
├── services/                    OrderSource interface + synthetic demo data (Phase 1 only)
├── assets/food/                 My Food Pile stand-in sprites (13 are bundled)
├── assets/pile/, assets/plates/ final artwork goes here (see docs/design/ART-BRIEF.md)
└── styles/global.css            design tokens, layout, reveal animations, reduced motion
```

Search and matching are pure functions in `shared/src/lib/` (`food-search.ts`,
`food-category.ts`), so the backend can reuse them in Phase 2.

### How the opening animation works

1. Orders load first, then the pile starts, so the drop runs exactly once.
2. `FoodPile` reserves a fixed-height footer zone (`--pile-height`) at the bottom of the page. The
   UI above it is hidden and `inert` until the pile reports "settled".
3. The pile measures its zone, picks an item size (~5.5% of the width, 40–92 px) and enough items
   to fill the zone. It loads and outlines the pictures, then builds a Matter.js world with a floor
   and side walls.
4. While falling, the canvas extends upwards over the hidden page. One `requestAnimationFrame` loop
   steps the physics in fixed 1/60 s steps.
5. Once every body is asleep (or after at most 7 simulated seconds), the final positions are kept
   and items that stick up above the zone are dropped. The physics engine is destroyed, the canvas
   shrinks to the zone, and a single static frame is drawn. **No loop runs after that.**
6. The UI then fades and slides in (0.5 s). With reduced motion, a hidden tab, or after a window
   resize, the pile is computed instantly without animating. A 9-second failsafe reveals the UI
   even if images never load.

## 3. Data flow

1. **[existing]** Apps Script imports Zomato order emails from Gmail into the "Formatted Data" tab.
   Columns: S. No., Order ID, Order Date, Order Time, Restaurant, Item Name, Quantity, Total Paid,
   Order Status, Gmail Message ID.
2. **[planned]** The backend reads the tab with read-only Sheets API scope, validates each row with
   a Zod schema, and maps it to `OrderLine`. It drops `S. No.` and `Gmail Message ID`. Rows that
   fail validation are counted and skipped, never logged in full.
3. **[planned]** The backend caches the parsed rows in memory for a short time (minutes) to avoid
   hitting Sheets API quotas. There is no database.
4. **[planned]** The frontend requests only what the page needs (for example a summary for a
   query and month), validates the response with the same shared schema, and renders it.

Open data questions for Phase 2: whether "Total Paid" is per item line or per order (repeated on
each line), the sheet's date/time formats, and which order statuses to exclude (e.g. cancelled).

## 4. API boundary

| Method | Path          | Status        | Response                                       |
| ------ | ------------- | ------------- | ---------------------------------------------- |
| GET    | `/api/health` | **[built]**   | `HealthResponse` → `{"status":"ok"}`           |
| GET    | `/api/...`    | **[planned]** | Order/insight endpoints, designed in Phase 1/2 |

Rules for every endpoint:

- Request and response schemas come from `shared/` and are enforced at runtime with
  `fastify-type-provider-zod`. An invalid request returns a 400 that never echoes the input.
- Errors always use the `ApiError` shape `{ statusCode, error, message }`. Server errors return a
  generic message.
- Routes live under `/api`. In development the Vite dev server forwards `/api` to the backend, so
  the browser only ever talks to one origin.
- **Endpoints that return order data need access control first** (see the security model).

## 5. Google Sheets integration design [planned, Phase 2]

- **Auth:** a Google Cloud **service account** with the Sheets API enabled. The sheet is shared
  with the service account's email as **Viewer** (read-only). Scope:
  `https://www.googleapis.com/auth/spreadsheets.readonly`.
- **Credentials:** a JSON key file stored **outside the repository**. Its path is given to the
  backend through `GOOGLE_APPLICATION_CREDENTIALS`, or the hosting platform injects it as a secret.
  Where the hosting platform supports it, keyless workload identity is preferred over a key file.
- **Config:** `GOOGLE_SHEETS_SPREADSHEET_ID` and `GOOGLE_SHEETS_RANGE` (e.g. `Formatted Data!A:J`).
  These are already listed in `backend/.env.example` but are not read by the code yet.
- **Boundary:** a single module `backend/src/integrations/google-sheets/` exposes something like
  `fetchOrderRows(): Promise<OrderLine[]>`. Nothing else in the backend imports Google libraries.
  Tests replace this module with a fake that returns synthetic rows. Real order data never goes
  into test fixtures.
- **No public exports:** the sheet is never "published to the web", and no CSV/JSON copy of the
  data is placed in `frontend/public` or the repository.

## 6. Dependency rules

```
frontend ──▶ shared ◀── backend        (frontend ✕ backend, shared ✕ either)
```

- These rules are enforced by ESLint `no-restricted-imports` in `eslint.config.js`. A violating
  import fails `npm run lint`.
- `shared` is consumed as the npm workspace package `@food-stack/shared`. Development tools
  (Vite, Vitest, tsx, `tsc --noEmit`) resolve it to its TypeScript source via the custom `source`
  export condition. The production backend build resolves it to `shared/dist`, which
  `npm run build` compiles first.
- Each library has one copy in the tree (checked with `npm ls`), and there is one root
  `package-lock.json`.
