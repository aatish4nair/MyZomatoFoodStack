# ADR-0002: Phase 2 data access (Google Sheets client, data model, local-only access)

- **Status:** Accepted
- **Date:** 2026-10-10
- **Decider:** Project owner (choices approved in conversation before implementation)

## Context

Phase 2 replaces synthetic data with the owner's real Zomato orders from the "Formatted Data" tab.
These are private purchase records. The app stays local and undeployed in this phase. The sheet's
exact formats (how Total Paid repeats, date style, status values) aren't documented in the
repository.

## Decisions

1. **Google client: `google-auth-library` plus one HTTPS call** to `spreadsheets.values.get`,
   rather than `googleapis`. It's the official auth library, a few small packages, and it covers
   the single read-only call needed. `googleapis` bundles clients for hundreds of unused APIs.
2. **Service account with Viewer access and the `spreadsheets.readonly` scope only.** Credentials
   come from a key-file path outside the repo (recommended) or inline JSON, in backend env only.
3. **Order-level contract.** The API returns `Order { …, totalPaidPaise, items[] }`: rows are grouped
   by Order ID, and money is stored in integer paise. This prevents double-counting when an order
   spans rows, and avoids floating-point drift. The Phase 1 per-line `OrderLine` contract was
   replaced; it had only internal consumers.
4. **Conservative validation:** reject rows without required values, keep unknown amounts or
   quantities as `null`, and never sum conflicting totals (see [DATA-MAPPING.md](DATA-MAPPING.md)).
5. **Endpoints:** `/api/orders` (all orders, searched client-side) and `/api/insights` (four
   metrics, for future use; not shown in the UI).
6. **Cache:** in-memory snapshot, 60 s TTL, single in-flight read, stale-on-error, and a 5 s retry
   delay after failures. Bounded by `SHEET_MAX_ROWS`.
7. **Access control: enforced local-only.** Loopback-only binding, a Host-header allow-list (against
   DNS rebinding), refusal of cross-site requests, and `no-store` responses. No login yet.
8. **Format verification:** a structure-only `npm run sheet:check` command that the owner runs,
   instead of reading real rows into the development conversation.
9. **Data source selection:** real API by default. Demo data only in `--mode demo` and tests, and
   excluded from production builds. No automatic fallback.

## Alternatives considered

| Alternative                                | Why not                                                                    |
| ------------------------------------------ | -------------------------------------------------------------------------- |
| `googleapis`                               | Very large install for one read-only call.                                 |
| Public CSV export / "anyone with the link" | Exposes private data. Rejected.                                            |
| Server-side search endpoint per keystroke  | More requests; the browser would still need all months for the month pill. |
| Passphrase login now                       | Not needed while local-only (owner's choice); required before deployment.  |
| Reading sample rows via a Drive connector  | Would put personal order data into the development conversation.           |

## Consequences

- Numbers are only as accurate as the assumptions in DATA-MAPPING.md "Open questions" until
  `sheet:check` confirms them.
- Anyone with access to the owner's logged-in computer can read the data. A login must exist
  before any deployment.
- One new runtime dependency on the backend: `google-auth-library` (Apache-2.0).
