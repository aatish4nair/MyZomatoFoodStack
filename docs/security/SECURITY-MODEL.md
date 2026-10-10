# Security model

Status markers: **[in place]** implemented and tested or verified · **[planned]** not yet
implemented. Nothing marked [planned] should be assumed to protect anything today.

## 1. Sensitive data

| Data                                               | Sensitivity       | Where it may live                                                     |
| -------------------------------------------------- | ----------------- | --------------------------------------------------------------------- |
| Google service-account key / any Google credential | **Secret**        | Outside the repo; injected into the backend process only              |
| Spreadsheet ID                                     | Confidential      | Backend environment only                                              |
| Order rows (items, restaurants, dates, amounts)    | **Personal**      | Google Sheet; backend memory (cache); API responses on localhost only |
| Gmail Message IDs, sheet row numbers               | Personal/internal | Sheet and backend parser only; never in API responses (tested)        |
| Food illustrations, UI code                        | Public            | Repository and frontend bundle                                        |

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
- **[planned]** In any future deployment, use the host's secret manager or keyless workload identity
  instead of a key file.
- **[in place, CI]** gitleaks scans the full Git history on every push and pull request. Note that
  `.gitignore` doesn't stop a determined `git add -f`; the scan is the backstop.

## 3. Trust boundaries

1. **Google ↔ backend.** Read-only Sheets scope [planned]. The service account sees only the one
   shared sheet.
2. **Backend ↔ browser.** Everything from the browser is untrusted:
   - **[in place]** Runtime request/response validation with shared Zod schemas.
   - **[in place]** Body limit of 16 KB. Only `GET` is allowed through CORS.
   - **[in place]** Safe errors: validation failures return a 400 without echoing input. 5xx errors
     return a generic message with no stack trace (tested). 404s are JSON.
   - **[in place]** Rate limit: 100 requests/minute per IP by default (configurable; tested).
   - **[in place]** Restrictive CORS: an explicit origin allow-list from `CORS_ORIGINS`. Wildcards
     and paths are rejected at startup (tested).
   - **[in place]** Security headers via Helmet. The API CSP is
     `default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`, plus
     `nosniff`, `Referrer-Policy: no-referrer`, CORP/COOP `same-origin`, and no `X-Powered-By`.
   - **[in place]** `trustProxy` is off, so client IPs (used for rate limiting) can't be spoofed via
     `X-Forwarded-For`. This must be revisited when a reverse proxy is added.
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

**Phase 2 decision ([ADR-0002](../architecture/ADR-0002-phase-2-data-access.md)): enforced
local-only.** The API now serves personal data (`/api/orders`, `/api/insights`), so these
controls are **[in place]** and tested:

1. **Loopback binding is mandatory.** `HOST` must be `127.0.0.1`, `::1` or `localhost`; anything
   else (e.g. `0.0.0.0`) stops startup. Other devices on your network can't connect.
2. **Host-header allow-list.** Requests whose `Host` isn't `localhost`, `127.0.0.1` or `[::1]` get
   403 before any data is read. This blocks **DNS rebinding**, where a malicious website points its
   own domain at `127.0.0.1` to read local services through your browser.
3. **Cross-site browser requests are refused** (`Sec-Fetch-Site: cross-site` → 403), in addition to
   the CORS allow-list. Other websites can't make your browser fetch this data.
4. **`Cache-Control: no-store`** on every API response.
5. Existing rate limiting (100/min per IP), body limit and safe errors still apply.

**Remaining risks (accepted for local use):**

- Anyone or any program that can use **your logged-in computer** can open `localhost:5173` or
  `localhost:3000` and read the data. There's no login. Lock your computer; don't run untrusted
  software.
- The key file grants read access to every sheet shared with the service account. Share only this
  sheet with it.
- **Before any deployment** beyond localhost, real authentication must be chosen and built: a
  single-user passphrase login, or an identity-aware proxy (external service; needs your
  approval). A private GitHub repository or an unguessable URL is **not** access control.

No authentication provider, OAuth integration or paid service has been added.

## 6. Deployment security considerations [planned]

- HTTPS only. HSTS is already sent by the backend, but browsers only honour it over HTTPS.
- Configure `CORS_ORIGINS` to the exact production origin.
- Set `trustProxy` to the specific proxy hop count once a reverse proxy/CDN is in front, so rate
  limiting sees real client IPs.
- Serve the frontend with the CSP header plus `frame-ancestors 'none'`.
- Store secrets in the host's secret store; never bake them into images or build output.
- Run `npm audit` and keep Dependabot/renovate-style updates flowing (not configured yet).

## 7. Supply chain

- **[in place]** One lockfile; CI installs with `npm ci`. Versions are exact (`save-exact`).
- **[in place]** `ignore-scripts=true`, so dependency install scripts don't run.
- **[in place, CI]** `npm audit --audit-level=high`, plus GitHub dependency review on pull
  requests.
- **[in place, CI]** Third-party GitHub Actions are pinned to full commit SHAs. The workflow token
  is read-only, except for `pull-requests: write` in the secret-scan job.
