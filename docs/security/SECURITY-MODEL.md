# Security model

Status markers: **[in place]** implemented and tested or verified · **[planned]** not yet
implemented. Nothing marked [planned] should be assumed to protect anything today.

## 1. Sensitive data

| Data                                               | Sensitivity       | Where it may live                                                                                        |
| -------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------- |
| Google service-account key / any Google credential | **Secret**        | Outside the repo; injected into the backend process only                                                 |
| Spreadsheet ID                                     | Confidential      | Backend environment only                                                                                 |
| Order rows (items, restaurants, dates, amounts)    | **Personal**      | Google Sheet; backend memory (cache); API responses: local, or **public** when deployed (owner decision) |
| Gmail Message IDs, sheet row numbers               | Personal/internal | Sheet and backend parser only; never in API responses (tested)                                           |
| Food illustrations, UI code                        | Public            | Repository and frontend bundle                                                                           |

## 2. Credential storage

- **[in place]** `.gitignore` excludes `.env`, `.env.*` (except `.env.example`), key files
  (`*.pem`, `*.key`, `*.p12`), and common Google credential file names (`*service-account*.json`,
  `credentials*.json`, `client_secret*.json`, `token*.json`), as well as `*.csv` and `private/`.
- **[in place]** `backend/.env.example` contains only variable names, non-secret defaults and
  placeholders.
- **[in place]** Environment variables are validated at startup (`backend/src/config/env.ts`).
  Errors name the variable but never print its value (covered by a test).
- **[in place]** Google credentials are read only by the backend, from
  `GOOGLE_SERVICE_ACCOUNT_KEY_FILE` (an **absolute** path; the setup guide stores it in
  `~/.config/my-zomato-food-stack/` with `chmod 600`, outside the repo) or
  `GOOGLE_SERVICE_ACCOUNT_JSON`. Only the `spreadsheets.readonly` scope is requested, and the sheet
  is shared with the service account as Viewer. Credential errors never echo values (tested).
- **[in place]** No Google value uses a `VITE_` prefix, so none can reach the frontend bundle. The
  production bundle was checked: it contains no demo or order data.
- **[in place]** In a deployment, the key is a Render Secret File (`/etc/secrets/…`), referenced by
  `GOOGLE_SERVICE_ACCOUNT_KEY_FILE`; it never enters the repository or build output.
- **[in place, CI]** gitleaks scans the full Git history on every push and pull request. Note that
  `.gitignore` doesn't stop a determined `git add -f`; the scan is the backstop.

## 3. Trust boundaries

1. **Google ↔ backend.** Read-only Sheets scope [planned]. The service account sees only the one
   shared sheet.
2. **Backend ↔ browser.** Everything from the browser is untrusted:
   - **[in place]** Runtime request/response validation with shared Zod schemas.
   - **[in place]** Body limit of 16 KB. Only `GET` is allowed through CORS.
   - **[in place]** Safe errors: validation failures return a 400 without echoing input. 5xx errors
     return a generic message with no stack trace; other 4xx errors use fixed wording (tested).
     404s are JSON.
   - **[in place]** Rate limit: 100 requests/minute per IP by default (configurable; tested).
   - **[in place]** Restrictive CORS: an explicit origin allow-list from `CORS_ORIGINS`. Wildcards
     and paths are rejected at startup (tested).
   - **[in place]** Security headers via Helmet. The API CSP is
     `default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`, plus
     `nosniff`, `Referrer-Policy: no-referrer`, CORP/COOP `same-origin`, and no `X-Powered-By`.
   - **[in place]** Proxy trust is off by default (`TRUST_PROXY_HOPS=0`), so client IPs used for
     rate limiting can't be spoofed via `X-Forwarded-For`. In production it trusts exactly the
     configured number of proxy hops (tested with forged headers).
3. **Frontend bundle ↔ the public.** Anything in `frontend/` can be read by anyone who loads the
   page:
   - **[in place]** The frontend contains no credentials and no real order data. Its assets are the
     public illustrations, the self-hosted font, and a small **synthetic** demo dataset
     (`frontend/src/services/demo-orders.ts`, all values invented) used until Phase 2.
   - **[in place]** The production build adds a CSP `<meta>` tag:
     `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'`.
     There are no third-party scripts, fonts or CDNs. The Outfit font is bundled and served from our own origin (verified in a headless-Chrome run of the production build: no CSP violations or console errors).
   - **[planned]** The static host should send the same CSP as a real HTTP header and add
     `frame-ancestors 'none'` (which `<meta>` can't express).

## 4. Logging

- **[in place]** Request logs record only request ID, method and **path**. Query strings, headers,
  bodies and response bodies are never logged (verified by running the server with `?q=…` and
  inspecting the log).
- **[in place]** 5xx errors log only the error name/code, not messages that might contain data.
- **[in place]** The Sheets integration logs only counts (`Order data refreshed`, rows read) and
  safe codes (`Order data refresh failed`, `UPSTREAM_AUTH`, …). It never logs row contents,
  Google's error bodies, tokens or the spreadsheet ID. `sheet:check` prints structure only.

## 5. API access control

There are two modes. Neither has a login.

### Local (default)

These controls are **[in place]** and tested:

1. **Loopback binding.** `HOST` defaults to `127.0.0.1`. A public bind (`0.0.0.0`/`::`) stops
   startup unless `NODE_ENV=production` **and** an allowed-hostname list is set.
2. **Host-header allow-list.** Requests whose `Host` isn't `localhost`, `127.0.0.1` or `[::1]` get
   403 before any data is read. This blocks **DNS rebinding**, where a malicious website points its
   own domain at `127.0.0.1` to read local services through your browser.
3. **Cross-site browser requests are refused** (`Sec-Fetch-Site: cross-site` → 403), in addition to
   the CORS allow-list.
4. **`Cache-Control: no-store`** on every API response.
5. Rate limiting (100/min per client), body limit, input validation and safe errors.

Anyone who can use your logged-in computer can read the data; lock your computer.

### Public deployment (owner decision, 2026-10-11)

The owner chose to publish the order history **without a login**
([Render deployment guide](../deployment/RENDER.md)). **Everything the API returns is public.** No
part of it is protected by an unguessable URL. These controls stay **[in place]** (tested):

1. **Public bind only in production.** `HOST=0.0.0.0` requires `NODE_ENV=production` and
   `ALLOWED_HOSTS` and/or Render's `RENDER_EXTERNAL_HOSTNAME`.
2. **Host allow-list stays on:** localhost plus those hostnames only; anything else gets 403.
   `/api/health` (no data) is exempt so the platform's health check works under any address.
3. **Minimal public fields.** `/api/orders` returns an opaque order ID, date, restaurant, Total
   Paid, status category and items only. No Zomato order IDs, time of day, raw status, sheet row
   numbers, Gmail Message IDs or data-quality counters (tested at field level).
4. **Proxy trust by hop count** (`TRUST_PROXY_HOPS`, production only), so rate limiting applies per
   visitor and a forged `X-Forwarded-For` doesn't help (tested).
5. Cross-site refusal, security headers, `no-store`, validation and fixed error wording, as locally.
   4xx responses use fixed messages and never repeat request details (tested).

**Accepted risks:** anyone on the internet can read the public fields above, and download the
dish-named plate images. Scraping is limited only by the rate limit. The service-account key can
read every sheet shared with it, so share only this sheet (as Viewer).

No authentication provider, OAuth integration or paid service has been added.

## 6. Deployment security

- **[in place]** HTTPS: Render serves `*.onrender.com` over HTTPS; the backend sends HSTS.
- **[in place]** Credentials as a Render **Secret File**, referenced by
  `GOOGLE_SERVICE_ACCOUNT_KEY_FILE=/etc/secrets/<file>`. Never in build output or the repository.
- **[in place]** The frontend calls `/api/*` on its own origin; a Render rewrite forwards it to the
  backend, so the production CSP (`connect-src 'self'`) needs no exception and no CORS is needed.
- **[planned, Render dashboard]** The static site should send the CSP as an HTTP header, plus
  `frame-ancestors 'none'` (see the deployment guide).
- Run `npm audit` and keep dependencies updated (not automated yet).

## 7. Supply chain

- **[in place]** One lockfile; CI installs with `npm ci`. Versions are exact (`save-exact`).
- **[in place]** `ignore-scripts=true`, so dependency install scripts don't run.
- **[in place, CI]** `npm audit --audit-level=high`, plus GitHub dependency review on pull
  requests.
- **[in place, CI]** Third-party GitHub Actions are pinned to full commit SHAs. The workflow token
  is read-only, except for `pull-requests: write` in the secret-scan job.
