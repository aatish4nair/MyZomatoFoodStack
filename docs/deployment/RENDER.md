# Deploying on Render (public, no login)

**Owner decision (2026-10-11):** the order history is published **without a login**. Everything
listed under "What is public" can be read by anyone on the internet who finds the site. Nothing is
protected by an unguessable address.

Two Render services, both from this repository's `main` branch:

1. **Web Service** (backend API): reads the Google Sheet with a read-only service account.
2. **Static Site** (frontend): the page and images; forwards `/api/*` to the backend.

Items marked _(Render)_ describe Render's platform behaviour as documented by Render; check them in
the dashboard while setting up.

## What is public

### API (through the static site's `/api/*` and the backend's own address)

| Endpoint                             | Public fields                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/health`                    | `status` (`"ok"`)                                                                                                                                                                                                                                                                                                                                                 |
| `GET /api/orders?month=all\|YYYY-MM` | `month`; `freshness` (`fetchedAt` time of the last sheet read, `stale`); and per order: `orderId` (opaque, e.g. `o0042`, **not** the Zomato order ID), `orderDate` (YYYY-MM-DD), `restaurant`, `totalPaidPaise` (order total in paise, or null), `statusCategory` (`successful` / `unsuccessful` / `unknown`), `items` (original Item Name and quantity, or null) |
| `GET /api/insights?month=…`          | `month`, `totalSpendingPaise`, `totalOrders`, `averageSpendingPaise`, `mostOrderedRestaurant` (names and order count), `basis` (counts of orders with/without totals and excluded orders), `freshness`                                                                                                                                                            |

**Never returned:** Zomato order IDs, time of day, raw status text, sheet row numbers ("S. No."),
Gmail Message IDs, the spreadsheet ID, credentials, Google's error messages, stack traces and
data-quality counters. Errors carry only a fixed message and, for data problems, a safe code such as
`UPSTREAM_AUTH`.

### Static files (the Static Site)

Everything in `frontend/dist`: `index.html`, `favicon.svg`, the JavaScript and CSS bundles, the
self-hosted font, the toy-style food sprites, and **every plate image in
`frontend/src/assets/plates/`, whose file names are dish names** (they reveal what was ordered,
consistent with the public order history). The bundle contains no credentials, no spreadsheet ID,
no demo data and no source maps.

## Before you start

1. Commit and push the local changes, so GitHub's `main` has the current code (Render builds from
   GitHub).
2. Keep the Google Sheet shared **only** with the service account, as **Viewer**. Do not make the
   sheet public.
3. Have the service-account JSON key file at hand (never paste it into chat, issues or code).

## 1. Backend: Render Web Service

| Setting           | Value                                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------- |
| Runtime           | Node                                                                                                  |
| Branch            | `main`                                                                                                |
| Root Directory    | _(leave blank: the repository root; npm workspaces need it)_                                          |
| Build Command     | `npm ci --include=dev && npm run build -w @food-stack/shared && npm run build -w @food-stack/backend` |
| Start Command     | `npm run start -w @food-stack/backend`                                                                |
| Health Check Path | `/api/health`                                                                                         |

**Secret File** _(Render: Environment → Secret Files)_: add a file named `service-account.json` with
the key's contents. _(Render)_ It is available to the service at `/etc/secrets/service-account.json`.

**Environment variables** (names; values are yours):

| Name                              | Value                                                                                                                                                               |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_VERSION`                    | `24`                                                                                                                                                                |
| `NODE_ENV`                        | `production`                                                                                                                                                        |
| `HOST`                            | `0.0.0.0`                                                                                                                                                           |
| `ALLOWED_HOSTS`                   | your **static site** hostname, e.g. `my-food-stack.onrender.com` (the backend's own hostname is added automatically from `RENDER_EXTERNAL_HOSTNAME`, set by Render) |
| `TRUST_PROXY_HOPS`                | `1` _(one Render proxy in front of the service; see "After deploying")_                                                                                             |
| `GOOGLE_SHEET_ID`                 | the ID part of the sheet URL                                                                                                                                        |
| `GOOGLE_SERVICE_ACCOUNT_KEY_FILE` | `/etc/secrets/service-account.json`                                                                                                                                 |
| `GOOGLE_SHEET_RANGE`              | optional; default `'Formatted Data'!A:J`                                                                                                                            |
| `CORS_ORIGINS`                    | optional; not needed with the rewrite below (requests are same-origin)                                                                                              |

`PORT` is set by Render _(Render)_ and read automatically. Do **not** set
`GOOGLE_SERVICE_ACCOUNT_JSON` as well: exactly one credential setting is allowed.

The server refuses to start (and says which setting is wrong, never its value) if `HOST=0.0.0.0` is
used without `NODE_ENV=production` and an allowed hostname.

### Check the backend

**1. Health.** Paste `https://<backend>.onrender.com/api/health` into the browser's address bar, or
run:

```sh
curl -s https://<backend>.onrender.com/api/health
```

Either shows `{"status":"ok"}`. The health check contains no order data or configuration, so it
answers in every case. (Before this was fixed, _clicking_ the link from another website, such as the
Render dashboard, returned 403 "Cross-site requests are not allowed": browsers mark such clicks as
cross-site, and the guard refused them. The data endpoints still refuse cross-site requests; the
website itself is unaffected because it calls `/api/*` on its own origin.)

**2. Google Sheets connection.** This prints **only the HTTP status code**, never order data:

```sh
curl -s -o /dev/null -w '%{http_code}\n' https://<backend>.onrender.com/api/orders
```

- `200`: the endpoint responded successfully, so the sheet was read.
- `503`: the sheet could not be read. Show the safe error code (it contains no order data or
  credentials):

  ```sh
  curl -s https://<backend>.onrender.com/api/orders | grep -o '"code":"[A-Z_]*"'
  ```

  `NOT_CONFIGURED`: `GOOGLE_SHEET_ID` or the credential setting is missing. `UPSTREAM_AUTH`: the key
  couldn't be loaded or Google refused it (check that the Secret File holds the **whole** JSON key,
  is named `service-account.json`, matches `GOOGLE_SERVICE_ACCOUNT_KEY_FILE`, and that the sheet is
  shared with that key's `client_email`). `UPSTREAM_NOT_FOUND`: wrong sheet ID or tab name.

- `403`: the request's hostname isn't allowed (see `ALLOWED_HOSTS`).

**Opening a data endpoint in the browser.** Paste `https://<backend>.onrender.com/api/orders` (or
`https://<static-site>.onrender.com/api/orders`) into the address bar. If you instead **click** a
link to it on another website (the Render dashboard, a chat app, an email, a document), the browser
marks the request as cross-site (`Sec-Fetch-Site: cross-site`) and the API answers `403` with
"Cross-site requests are not allowed." This is intended: it stops other websites from linking to or
embedding the order data. It doesn't affect the website itself, whose requests are same-origin
through the `/api/*` rewrite, or `curl`, which sends no such header.

## 2. Frontend: Render Static Site

| Setting           | Value                                                           |
| ----------------- | --------------------------------------------------------------- |
| Branch            | `main`                                                          |
| Root Directory    | _(leave blank)_                                                 |
| Build Command     | `npm ci --include=dev && npm run build -w @food-stack/frontend` |
| Publish Directory | `frontend/dist`                                                 |
| Environment       | `NODE_VERSION` = `24` (no secrets: the frontend needs none)     |

**Redirects/Rewrites** _(Render)_:

| Source   | Destination                            | Action  |
| -------- | -------------------------------------- | ------- |
| `/api/*` | `https://<backend>.onrender.com/api/*` | Rewrite |

**Headers** _(Render)_, path `/*`:

| Name                      | Value                                                                                                                                                                                                |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'` |
| `X-Content-Type-Options`  | `nosniff`                                                                                                                                                                                            |
| `Referrer-Policy`         | `no-referrer`                                                                                                                                                                                        |

No "rewrite everything to index.html" rule is needed: the site is a single page without client-side
routes.

## After deploying

1. Open the static site. The food falls, the month menu lists your months and searches return
   results.
2. If the page says "Your orders couldn't be loaded", open the backend logs: a 403 means the
   hostname the rewrite uses isn't in `ALLOWED_HOSTS`; a 503 code (e.g. `UPSTREAM_AUTH`) points to
   the sheet setup ([GOOGLE-SHEETS-SETUP.md](../development/GOOGLE-SHEETS-SETUP.md)).
3. **Check that the rate limit is per visitor.** `TRUST_PROXY_HOPS=1` assumes one Render proxy hop
   in front of the service; confirm it once after the first deploy:
   1. On your computer, open `https://<static-site>.onrender.com/api/health` twice, a few seconds
      apart, and note the `x-ratelimit-remaining` response header each time (browser developer
      tools → Network → the request → Response Headers). It goes down by one per request, e.g. 99,
      then 98.
   2. Within the same minute, open the same address from **another network**, e.g. your phone on
      mobile data (not on your home Wi-Fi), and read the header there too (or ask someone else to).
   3. **Per visitor (correct):** the second network starts its own count at 99. **Shared (needs
      fixing):** it continues your count (e.g. 97), so every visitor shares one limit of 100 per
      minute.
   4. If it's shared, try `TRUST_PROXY_HOPS=2`, redeploy and repeat. Use the **smallest** value
      that gives separate counts, and never more than the real number of proxies: a higher value
      would let visitors forge their address and evade the limit. If no value works, set it back to
      `1` and raise `RATE_LIMIT_MAX` instead; each page visit makes only one API call, so the
      shared limit is roughly that many visits per minute for the whole site.
   5. Repeat the check through the backend's own address (`https://<backend>.onrender.com/api/health`)
      if visitors may use it directly.
4. _(Render)_ Free web services sleep when idle; the first visit after a pause can take up to about
   a minute.

## Local development is unchanged

Without these variables the backend binds to `127.0.0.1`, answers only to `localhost`, trusts no
proxy, and the Vite dev server forwards `/api` to it, exactly as before.
