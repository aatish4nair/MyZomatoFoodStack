# Product requirements: My Zomato Food Stack

**Visual specification:** [`docs/design/approved-design.png`](../design/approved-design.png), an
example with dummy data, described in [`DESIGN-SPEC.md`](../design/DESIGN-SPEC.md). The page must
match it faithfully: no redesign, no dashboard cards, no extra UI, and no emoji in place of food
artwork.

## Page

- [x] Warm off-white background.
- [x] Header title **"My Zomato food stack"**, with "Zomato" in red.
- [x] Month selector beside the title.
- [x] Search field on the left with a thin underline.
- [x] Left column after a matching search: large **matching order count**, **food name**, **amount
      paid**, **restaurant**, **order date**, **quantity**.
- [x] Right side after a matching search: **exactly one** representative food plate, however many
      orders match.
- [x] Right side with no active search: **empty**.
- [x] No matches: **never** show an unrelated food illustration.
- [x] Compact, colourful **footer collage** of food illustrations. Items are relatively small, and
      **no decorative effects emerge from the food**.

## Motion

- [x] On page load/refresh, illustrations fall from above, collide, bounce, and settle into the
      footer pile (Matter.js physics, adapted from My Food Pile).
- [x] The interface appears **after** the opening animation.

## Search

- [x] An animated placeholder cycles through **food names from the order data**; each stays
      visible for **about 1.8 seconds** (at least one second). _(Real sheet data from Phase 2; synthetic only in `npm run dev:demo`.)_
- [x] Bracketed text never appears in placeholder suggestions **or the result title**. Use `toDisplayName()` from
      `@food-stack/shared` (**built and tested in Phase 0**). The original item names are kept
      unchanged in the data.
- [x] The placeholder animation pauses while the field has text and resumes once it is cleared
      (it keeps rotating while the empty field has focus). With reduced motion it shows a stable
      placeholder.
- [x] On mouse/trackpad devices the search field is focused when the page appears and after clicks
      on non-interactive areas or a month picked with the mouse. Keyboard use of other controls is
      never interrupted, and touch devices are never auto-focused (no surprise keyboard).
- [x] The month selector opens on **All Months**, followed by the months with orders grouped by
      year (latest year first, newest month first, dividers between groups).
- [x] Results update according to the selected month.
- [x] Autocomplete: typing lists suggestions (categories such as "Biryani · All variants", then
      dishes) and never selects one; the user picks with mouse, touch, or ↓/↑ + Enter. Escape
      closes the list. Picking a category shows every variant in the selected range; picking a dish
      shows only that dish.
- [x] Every item name maps to one Dish Category and a Dish Type (`dish-category.ts`); unknown
      names go to `Other`, reported by `npm run dish:categories`.
- [x] An order's Total Paid is only counted for a dish/category when the order contains nothing
      else (no item prices exist); otherwise the amount note says it was left out.
- [x] Amounts are displayed in whole rupees (rounded half up, display only; totals stay in paise).
- [x] The large result number is bold and upright.
- [ ] Photorealistic plate artwork for each dish (owner to supply; see ART-BRIEF.md and
      `npm run art:coverage`). Until then: exact-dish stand-ins or a neutral empty plate.

## Data

- Source: Google Sheet "My Zomato Food Pile", tab "Formatted Data", filled by the existing Apps
  Script. That workflow is preserved and not modified.
- [x] The backend reads the sheet server-side with a read-only service account (Phase 2). The
      frontend never sees credentials, the sheet ID or Gmail Message IDs.
- [x] The four metrics (total spending, total orders, average spending, most-ordered restaurant)
      are available from `GET /api/insights`. **Not shown in the UI**, by design.
- Mapping and policies: [DATA-MAPPING.md](../architecture/DATA-MAPPING.md). Its former open
  questions were resolved against the real sheet with `npm run sheet:check` (2026-10-10).

## Artwork

**Decision (2026-10-09):** the owner will supply new artwork in the design's style, both pile
items and plated dishes. See [`ART-BRIEF.md`](../design/ART-BRIEF.md). Until it arrives, the My
Food Pile sprites serve as temporary placeholders. This resolves the earlier issues: the steam on
`chai.png`, the missing takeaway fallback, and the style mismatch.

Remaining points for Phase 1:

| Issue                                                                       | Plan                                                                             |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Upstream draws drop shadows and a hover "grow" effect on items              | Leave them out when porting                                                      |
| Upstream picture-matching rules (`CATS`) were written for Swiggy item names | Port the rules to `shared/`, then tune them against real sheet names (privately) |
| Upstream loads the Outfit font from Google Fonts                            | Self-host whichever font the design uses (strict CSP)                            |
