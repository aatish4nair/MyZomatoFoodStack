# Product requirements: My Zomato Food Stack

**Visual specification:** [`docs/design/approved-design.png`](../design/approved-design.png), an
example with dummy data, described in [`DESIGN-SPEC.md`](../design/DESIGN-SPEC.md). The page must
match it faithfully: no redesign, no dashboard cards, no extra UI, and no emoji in place of food
artwork.

## Page

- [x] Warm off-white background.
- [x] Header title **"My Zomato food Stack"**, with "Zomato" in red.
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

- [x] An animated placeholder cycles through **food names from the order data**, changing every
      **1 second**. _(Synthetic demo data until the Google Sheet is connected in Phase 2.)_
- [x] Bracketed text never appears in placeholder suggestions **or the result title**. Use `toDisplayName()` from
      `@food-stack/shared` (**built and tested in Phase 0**). The original item names are kept
      unchanged in the data.
- [x] The placeholder animation pauses while the field is focused or has text, and resumes once
      it is empty and no longer focused. With reduced motion it shows a stable placeholder.
- [x] Results update according to the selected month.

## Data

- Source: Google Sheet "My Zomato Food Pile", tab "Formatted Data", filled by the existing Apps
  Script. That workflow is preserved and not modified.
- The backend reads the sheet server-side (Phase 2). The frontend never sees credentials.

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
