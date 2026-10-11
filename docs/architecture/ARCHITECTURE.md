# Architecture

Status markers: **[built]** exists and is tested · **[planned]** designed here, not built yet.

## 1. System boundaries

```
 ┌──────────── Google (private to the owner) ────────────┐
 │  Gmail ──▶ Apps Script (existing, unchanged) ──▶ Sheet │
 │                          "My Zomato Food Pile" / "Formatted Data"
 └──────────────────────────────┬─────────────────────────┘
                                │ Google Sheets API, read-only, service account   [built]
                ════════════════╪═══════════ trust boundary: server side ═══════════
                                ▼
                      backend/ (Fastify, Node, bound to localhost)        [built]
                      validates, filters, aggregates
                                │ HTTPS JSON under /api, validated by shared schemas
                ════════════════╪═══════════ trust boundary: the internet/browser ══
                                ▼
                      frontend/ (React, static files in the browser)      [built]
```

- The **browser is untrusted**. It never receives Google credentials, the spreadsheet ID, Gmail
  message IDs, sheet row numbers, Zomato order IDs or order times. It receives only the public
  order fields it needs to search (from `/api/orders`). Locally the API answers only to
  `localhost`; in the public Render deployment those fields are intentionally public
  ([ADR-0003](ADR-0003-public-deployment-on-render.md), security model §5).
- The **backend is the only component that talks to Google**.
- The existing **Apps Script import stays exactly as it is**. This project only reads the sheet.

## 2. Module responsibilities

| Module      | Responsibility                                                                                                                                                                                      | Must not                                          |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `shared/`   | Zod schemas + inferred types (`Order`, `OrderItem`, `MonthFilter`, `OrdersResponse`, `Insights`, `SearchSummary`, `ApiError`), pure helpers (`toDisplayName`, search, status policy, paise parsing) | Import from `frontend` or `backend`; do I/O       |
| `backend/`  | Config validation, HTTP security (headers, CORS, rate limit), error handling, API routes, Google Sheets integration                                                                                 | Import from `frontend`; log personal data         |
| `frontend/` | Rendering, animation, user interaction; calls the API over HTTP                                                                                                                                     | Import from `backend`; hold secrets or data files |

### Backend layout (current)

```
backend/src/
├── server.ts                          starts the process (reads env, listens, graceful shutdown)
├── app.ts                             buildApp(env, deps): plugins, guards, routes; used by tests
├── config/env.ts                      Zod-validated environment: HOST (loopback by default; 0.0.0.0 only in production
│                                      with ALLOWED_HOSTS), allowed hostnames, TRUST_PROXY_HOPS, Google settings
├── integrations/google-sheets/        the ONLY code that talks to Google (read-only values.get)
├── lib/                               logger rules, safe data-error codes and messages
├── middleware/                        error handler, request guard (Host allow-list + Sec-Fetch-Site, no-store)
├── modules/health/                    GET /api/health
├── modules/orders/                    sheet cell parsers, sheet → orders parser, cached repository, GET /api/orders
├── modules/insights/                  the four metrics, GET /api/insights
└── scripts/check-sheet.ts             `npm run sheet:check`: structure-only diagnostics
```

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

1. **[existing, unchanged]** Apps Script imports Zomato order emails from Gmail into the
   "Formatted Data" tab.
2. **[built]** On request, the backend's repository returns a cached snapshot, or reads the tab
   with `spreadsheets.values.get` (read-only scope, unformatted values, 10 s timeout).
3. **[built]** `parse-sheet.ts` finds columns by header, validates every row, groups rows by Order
   ID into `Order`s, and drops `S. No.` and `Gmail Message ID`. Rules: [DATA-MAPPING.md](DATA-MAPPING.md).
4. **[built]** The snapshot is cached in memory for `SHEET_CACHE_TTL_SECONDS` (default 60).
   Concurrent requests share one read. If a refresh fails, the last good snapshot is served with
   `freshness.stale: true`; with none, a safe error code is returned, and Google isn't retried for
   5 s. There is no database.
5. **[built]** The frontend's `apiOrderSource` fetches `/api/orders?month=all` once, validates it
   with the shared schema, and the page searches it locally (month filter, matching, placeholder).
   Demo data is used only in `npm run dev:demo` and tests; it isn't in production builds, and
   there is no fallback to it.

## 4. API boundary

| Method | Path                               | Response                                                                     |
| ------ | ---------------------------------- | ---------------------------------------------------------------------------- |
| GET    | `/api/health`                      | `HealthResponse` → `{"status":"ok"}` (no configuration details)              |
| GET    | `/api/orders?month=all\|YYYY-MM`   | `OrdersResponse`: `month`, `orders` (public fields only, below), `freshness` |
| GET    | `/api/insights?month=all\|YYYY-MM` | `Insights`: the four metrics + `basis` + `freshness` (not shown in the UI)   |

Why these two data endpoints: the page needs every month (for the month pill and instant,
offline-feeling search), so one `/api/orders` read serves it; a per-keystroke search endpoint would
add requests without reducing what the browser receives. `/api/insights` exists for future use and
keeps metric logic on the server.

Rules for every endpoint:

- Query and response schemas come from `shared/` and are enforced at runtime
  (`fastify-type-provider-zod`). An invalid query returns 400 without echoing the input. Response
  validation strips any field outside the contract.
- Errors use `ApiError` `{ statusCode, error, message, code? }`. Data problems return **503** with a
  safe `code` (`NOT_CONFIGURED`, `UPSTREAM_AUTH`, `UPSTREAM_NOT_FOUND`, `UPSTREAM_QUOTA`,
  `UPSTREAM_TIMEOUT`, `UPSTREAM_ERROR`, `MALFORMED_SHEET`). Google's raw errors are never forwarded
  or logged.
- All `/api` responses send `Cache-Control: no-store`.
- **Public order fields** (`PublicOrder`, built by `toPublicOrders` in `shared/`): an opaque
  `orderId` (`o0001`…, assigned oldest → newest; never the Zomato order ID), `orderDate`,
  `restaurant`, `totalPaidPaise`, `statusCategory` and `items` (`name`, `quantity`). The order
  time, raw status text and data-quality counters stay inside the backend (quality counts go to the
  logs and `npm run sheet:check`).
- **Request guard:** the `Host` header must be `localhost` or, in a production deployment, one of
  `ALLOWED_HOSTS` / Render's `RENDER_EXTERNAL_HOSTNAME`; `/api/health` (no data) is exempt for
  platform health checks. Cross-site browser requests are refused. Client errors use fixed
  messages. Proxy headers are trusted only for `TRUST_PROXY_HOPS` hops (production only), so rate
  limiting applies per visitor (see the security model §5).

## 5. Google Sheets integration [built]

- **Library:** `google-auth-library` (official, Apache-2.0) obtains an access token for a
  **service account**; one `fetch` calls `GET https://sheets.googleapis.com/v4/spreadsheets/{id}/values/{range}`
  (see [ADR-0002](ADR-0002-phase-2-data-access.md)).
- **Scope:** `https://www.googleapis.com/auth/spreadsheets.readonly` only. The sheet is shared with
  the service account as **Viewer**.
- **Configuration** (`backend/.env`): `GOOGLE_SHEET_ID`, `GOOGLE_SHEET_RANGE` (default
  `'Formatted Data'!A:J`), and exactly one of `GOOGLE_SERVICE_ACCOUNT_KEY_FILE` (recommended: an
  absolute path outside the repo) or `GOOGLE_SERVICE_ACCOUNT_JSON`. Without `GOOGLE_SHEET_ID` the API
  runs and reports `NOT_CONFIGURED`; a half-configured `.env` stops startup with a message naming
  the variable.
- **Boundary:** `SheetValuesReader.readValues(): Promise<unknown[][]>` is all the rest of the
  backend sees. Tests inject fakes; no test touches Google.
- **No public exports:** the sheet is never published, and no copy of the data is stored in the
  repository or `frontend/public`.
- **Setup guide:** [docs/development/GOOGLE-SHEETS-SETUP.md](../development/GOOGLE-SHEETS-SETUP.md).

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
