# ADR-0003: Public deployment on Render

- **Status:** Accepted
- **Date:** 2026-10-11
- **Decider:** Project owner (explicit decision to publish the order history without a login)
- **Supersedes:** [ADR-0002](ADR-0002-phase-2-data-access.md) decision 7, "Access control:
  enforced local-only", **for the explicitly configured public deployment mode only**. Local
  development keeps every ADR-0002 protection.

## Context

ADR-0002 made the API local-only because it serves personal purchase records and has no login:
loopback-only binding, a Host-header allow-list, refusal of cross-site requests and
`Cache-Control: no-store`. It required real authentication before any deployment.

The owner has now chosen to host the app on Render (a Static Site for the frontend and a Web
Service for the backend) and to make the order history **intentionally public, without a login**.
The backend as built could not run there: it refused `HOST=0.0.0.0`, answered only to `localhost`,
and trusted no proxy, so rate limiting behind Render's proxy would treat every visitor as one.

## Decisions

1. **Two modes, chosen by configuration.** The default stays local: `HOST=127.0.0.1`, answering
   only to `localhost`, no proxy trust. A public bind (`HOST=0.0.0.0` or `::`) is accepted only
   with `NODE_ENV=production` **and** at least one allowed hostname (`ALLOWED_HOSTS`, or Render's
   automatically set `RENDER_EXTERNAL_HOSTNAME`). Any other address is always refused. A
   misconfiguration stops startup, naming the setting but never its value.
2. **The Host allow-list stays on in production:** localhost plus the configured hostnames.
   Requests addressed to any other hostname get 403. Only `/api/health`, which returns no data, is
   exempt, so Render's health check works under an internal address.
3. **Public data is minimised.** `/api/orders` returns only the fields the website uses: an opaque
   order ID (`o0001`…, assigned oldest → newest, not reversible to the Zomato order ID), date,
   restaurant, Total Paid, status category and items (original name, quantity). Zomato order IDs,
   order times, raw status text, sheet row numbers, Gmail Message IDs and data-quality counters are
   not sent. The same shape is used locally and in production.
4. **Proxy trust by explicit hop count.** `TRUST_PROXY_HOPS` (default 0, production only, at most 5) trusts exactly that many proxies in `X-Forwarded-For`, so rate limiting applies per visitor
   and a visitor can't evade it by forging the header.
5. **Same-origin API.** The frontend keeps calling `/api/*`; a Render rewrite forwards it to the
   backend. The production CSP (`connect-src 'self'`) needs no exception, and no CORS is required.
6. **Credentials stay server-side** as a Render Secret File referenced by
   `GOOGLE_SERVICE_ACCOUNT_KEY_FILE`. Google access stays read-only
   (`spreadsheets.readonly`), and the sheet stays shared only with the service account, as Viewer.
7. Everything else from ADR-0002 is unchanged: input validation, safe errors (now with fixed
   wording for all client errors), security headers, `no-store`, the 16 KB body limit, rate
   limiting and log redaction.

## Alternatives considered

| Option                                  | Why not chosen                                                                                        |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Keep local-only                         | The owner wants the site online.                                                                      |
| Add a login                             | The owner explicitly chose public access; it would also add a dependency or external service.         |
| Disable the Host check in production    | Unnecessary: an explicit allow-list keeps the API answering only under its real names.                |
| `trustProxy: true`                      | Trusts every `X-Forwarded-For` entry, so visitors could forge their address and evade the rate limit. |
| Frontend calls the backend URL directly | Needs a configurable API URL, a looser CSP and CORS; the same-origin rewrite needs none of these.     |
| Send the full internal order record     | Exposes Zomato order IDs, times and internal counters the website doesn't use.                        |

## Consequences

- **Anyone on the internet can read the public order fields** and the aggregated insights, and can
  download the plate images, whose file names are dish names. Nothing is protected by an obscure
  URL; scraping is limited only by the rate limit. This is the owner's accepted decision.
- Local development behaves exactly as before.
- Two settings depend on Render's real environment and must be confirmed after the first deploy:
  the proxy hop count (see the rate-limit check in [RENDER.md](../deployment/RENDER.md)) and the
  hostname under which rewritten requests reach the backend (allowed either way when
  `ALLOWED_HOSTS` includes the static-site hostname).
- Covered by tests: production host rules, the allow-list and health exemption, per-visitor rate
  limiting with forged headers, field-level checks of the public response, and fixed error wording.
