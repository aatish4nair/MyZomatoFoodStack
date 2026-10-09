# Security model

Status markers: **[in place]** implemented and tested or verified · **[planned]** not yet
implemented. Nothing marked [planned] should be assumed to protect anything today.

## 1. Sensitive data

| Data                                               | Sensitivity       | Where it may live                                                      |
| -------------------------------------------------- | ----------------- | ---------------------------------------------------------------------- |
| Google service-account key / any Google credential | **Secret**        | Outside the repo; injected into the backend process only               |
| Spreadsheet ID                                     | Confidential      | Backend environment only                                               |
| Order rows (items, restaurants, dates, amounts)    | **Personal**      | Google Sheet; backend memory; API responses to an authorised user      |
| Gmail Message IDs, sheet row numbers               | Personal/internal | Sheet and backend only; dropped before the API (see `OrderLineSchema`) |
| Food illustrations, UI code                        | Public            | Repository and frontend bundle                                         |

## 2. Credential storage

- **[in place]** `.gitignore` excludes `.env`, `.env.*` (except `.env.example`), key files
  (`*.pem`, `*.key`, `*.p12`), and common Google credential file names (`*service-account*.json`,
  `credentials*.json`, `client_secret*.json`, `token*.json`), as well as `*.csv` and `private/`.
- **[in place]** `backend/.env.example` contains only variable names, non-secret defaults and
  placeholders.
- **[in place]** Environment variables are validated at startup (`backend/src/config/env.ts`).
  Errors name the variable but never print its value (covered by a test).
- **[planned]** Store the Google key file outside the project folder. In production, use the host's
  secret manager or keyless workload identity.
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
   - **[in place]** The frontend contains no credentials and no order data. The only assets are the
     public illustrations.
   - **[in place]** The production build adds a CSP `<meta>` tag:
     `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'`.
     There are no third-party scripts, fonts or CDNs; fonts will be self-hosted.
   - **[planned]** The static host should send the same CSP as a real HTTP header and add
     `frame-ancestors 'none'` (which `<meta>` can't express).

## 4. Logging

- **[in place]** Request logs record only request ID, method and **path**. Query strings, headers,
  bodies and response bodies are never logged (verified by running the server with `?q=…` and
  inspecting the log).
- **[in place]** 5xx errors log only the error name/code, not messages that might contain data.
- **[planned]** The Sheets integration will log counts (rows read, rows rejected), never row
  contents.

## 5. API access control

**[planned, required before any internet deployment.]** Today the API has no data endpoints and
binds to `127.0.0.1` by default, so it's reachable only from this computer. **A private GitHub
repository or an unguessable URL is not access control.**

Before the backend serves order data beyond `localhost`, one of these must be chosen (as a new
ADR) and implemented:

1. **Stay local-only.** Run on your own machine; no internet exposure. Simplest; no new services.
2. **Single-user passphrase login in the backend.** A long passphrase hashed with a slow hash
   (e.g. scrypt/argon2), an `HttpOnly; Secure; SameSite=Strict` session cookie, and login rate
   limiting. No third-party provider, but more code to get right.
3. **An identity-aware proxy in front of the app** (e.g. a zero-trust access gateway with Google
   sign-in limited to your account). Strong and little code, but it's an external service and
   needs your approval.

No authentication provider, OAuth integration or paid service will be added without your explicit
approval.

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
