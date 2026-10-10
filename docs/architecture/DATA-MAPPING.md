# Data mapping: "Formatted Data" sheet → orders

Code: `backend/src/modules/orders/parse-sheet.ts` and `sheet-values.ts`; shared policy in
`shared/src/lib/order-status.ts`, `money.ts` and `food-search.ts`.

> **Verified against the real sheet on 2026-10-10** with `npm run sheet:check` and count-only
> checks (no personal data printed): 83 rows, 83 distinct orders, 0 rejected, all 10 columns
> present, dates and times stored as real sheet values, every status `delivered`, every item written
> `N x Item name`, and per-item quantities adding up to the Quantity cell in every multi-item row.

## Columns

Columns are found by **header text** in the first non-blank row (case, spaces and punctuation are
ignored), so reordering columns doesn't break anything.

| Sheet column     | Required | Becomes                      | Rules                                                                                                                                                                        |
| ---------------- | -------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S. No.           | no       | _(not used)_                 | Ignored; never sent to the browser. Not used for duplicate detection.                                                                                                        |
| Order ID         | **yes**  | `orderId`                    | Text, or a whole number (written without scientific notation). Groups rows into one order.                                                                                   |
| Order Date       | **yes**  | `orderDate` (`YYYY-MM-DD`)   | Sheets date, `YYYY-MM-DD`, **day-first** `DD/MM/YYYY` (also `-` or `.`), `DD Mon YYYY`, `Mon DD, YYYY`. Month-first is never assumed. Impossible dates (31/02) are rejected. |
| Order Time       | no       | `orderTime` (`HH:mm`) / null | Sheets time, `HH:mm[:ss]`, or `h:mm[:ss] AM/PM`. Blank or unreadable → null (the row is kept).                                                                               |
| Restaurant       | **yes**  | `restaurant`                 | Trimmed text. Compared exactly (so "Domino's" and "Dominos" are different restaurants).                                                                                      |
| Item Name        | **yes**  | `items[].name`               | Original text is kept exactly (brackets included). A cell may list several items separated by `;`.                                                                           |
| Quantity         | no       | `items[].quantity` / null    | Positive whole number. With several items, a `;`-list of the **same length** pairs up; otherwise unknown.                                                                    |
| Total Paid       | **yes**  | `totalPaidPaise` / null      | Number, or text like `₹1,234.50`, `Rs. 99`, `INR 12.5`. Stored as whole **paise**. Blank/invalid → null.                                                                     |
| Order Status     | **yes**  | `status`, `statusCategory`   | See status policy.                                                                                                                                                           |
| Gmail Message ID | no       | _(not used)_                 | Only used to recognise exact duplicate rows; **never** sent to the browser.                                                                                                  |

## Validation policy

| Situation                                                          | What happens                                                                                             |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Required **column** missing from the header                        | Whole request fails with `MALFORMED_SHEET` (nothing partial is served).                                  |
| Blank row                                                          | Skipped, counted in `quality.blankRows`.                                                                 |
| Missing order ID, invalid date, missing restaurant/item name       | Row rejected, counted in `quality.rejectedRows` (by reason in `sheet:check`). Never repaired or guessed. |
| Missing/invalid Total Paid                                         | Order kept with `totalPaidPaise: null`; excluded from spending; counted.                                 |
| Rows of one order disagree on date or restaurant                   | The whole order is rejected (its rows are counted as rejected).                                          |
| Rows of one order carry **different** Total Paid values            | Total becomes **null** (`ordersWithConflictingTotals`). Totals are never summed or picked arbitrarily.   |
| Rows of one order carry different statuses                         | Status becomes blank → `unknown` → excluded from counts.                                                 |
| Identical rows (all columns except S. No.), e.g. re-imported email | Counted once.                                                                                            |
| More rows than `SHEET_MAX_ROWS` (default 20 000)                   | `MALFORMED_SHEET` (bounded reads).                                                                       |

## Status policy

One rule (`isCountedOrder`) is used for search, months, the placeholder and all metrics:

| Category       | Matching wording (case-insensitive)                                                                   | Effect                                                 |
| -------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `unsuccessful` | cancel(l)ed, cancellation, refund(ed), fail(ed/ure), reject(ed), undelivered, not delivered, declined | Excluded. No refund amounts are invented.              |
| `successful`   | delivered, completed, success(ful)                                                                    | Counted.                                               |
| `unknown`      | blank or anything else                                                                                | Excluded and reported (`basis.excludedUnknownStatus`). |

Unsuccessful wording wins ("Delivery failed" → unsuccessful).

## Search result (left panel)

- **Matching:** every typed word must match the start of a word in an **original** item name, in any
  order. Brackets are removed **only for display**.
- **Variants:** matching items are grouped by display name. A generic query that matches several
  foods returns a `clarify` outcome (the real variants) instead of merging them; an exact food name
  or a single match returns that one food. A result always covers exactly one food.
- **Count:** distinct matching **orders** (by order ID), not item occurrences.
- **Amount paid:** the sum of the matching orders' **whole-order totals**, each counted once. The
  sheet has no per-item prices, so an order's total includes its other items. If some matching
  orders have no known total, the amount covers the rest and the UI says "amount missing for N
  orders".
- **Restaurant / date / name:** from the most recent matching order.
- **Quantity:** the sum over matching items, or "not recorded" if any of them is unknown.

## The four metrics (`GET /api/insights?month=`)

Over counted orders in the selected month, each order ID once:

- **A, total spending** = Σ `totalPaidPaise` of orders with a known total (integer paise: no
  floating-point drift).
- **B, total orders** = number of distinct counted order IDs.
- **C, average spending** = A ÷ (orders with a known total), rounded to the nearest paisa. `null`
  when there are none.
- **D, most-ordered restaurant** = the restaurant(s) with the most counted orders. **Ties:** every
  tied name is returned, sorted A→Z, with the shared count. `null` with no orders.
- `basis` reports what was excluded (unsuccessful, unknown status) and how many orders lack a total,
  so limitations are visible.

## Resolved questions (real sheet, 2026-10-10)

1. **Total Paid** is per **order**: one row per order (83 rows, 83 order IDs), so there are no
   repeated or conflicting totals. The conflict rule remains as a safeguard.
2. **Quantity** is the total number of units in the order; each item's own quantity is its `N x `
   prefix (they matched in all 33 multi-item rows).
3. **Order Status:** only `delivered` (counted). Any new label will show as `unknown` in
   `sheet:check` and must be added to the policy deliberately.
4. **Dates and times** are real sheet values (serial numbers), so there's no day/month ambiguity.
5. **Semicolon-separated items:** 33 of 83 rows (2–3 items each).

## Remaining limitation

- **Search amounts for multi-item orders** include the whole order's total (the sheet has no
  per-item prices). This affects 33 of 83 orders.
