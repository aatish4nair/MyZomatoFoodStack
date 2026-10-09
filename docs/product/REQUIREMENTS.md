# Product requirements: My Zomato Food Stack

**Visual specification:** the approved design screenshot. It should be stored at
`docs/design/approved-design.png` (**not yet added**; needed before Phase 1 UI work). The page
must match it faithfully: no redesign, no dashboard cards, no extra UI, and no emoji in place of
food artwork.

## Page

- [ ] Warm off-white background.
- [ ] Header title **"My Zomato food Stack"**, with "Zomato" in red. _(Phase 0 placeholder shows
      the title only.)_
- [ ] Month selector beside the title.
- [ ] Search field on the left with a thin underline.
- [ ] Left column after a matching search: large **matching order count**, **food name**, **amount
      paid**, **restaurant**, **order date**, **quantity**.
- [ ] Right side after a matching search: **exactly one** representative food plate, however many
      orders match.
- [ ] Right side with no active search: **empty**.
- [ ] No matches: **never** show an unrelated food illustration.
- [ ] Compact, colourful **footer collage** of food illustrations. Items are relatively small, and
      **no decorative effects emerge from the food**.

## Motion

- [ ] On page load/refresh, illustrations fall from above, collide, bounce, and settle into the
      footer pile (Matter.js physics, adapted from My Food Pile).
- [ ] The interface appears **after** the opening animation.

## Search

- [ ] An animated placeholder cycles through **real food names from the Google Sheet**, changing
      every **1 second**.
- [ ] Bracketed text never appears in placeholder suggestions. Use `toDisplayName()` from
      `@food-stack/shared` (**built and tested in Phase 0**). The original item names are kept
      unchanged in the data.
- [ ] The placeholder animation pauses when the user interacts with the field, and resumes when
      the field is cleared.
- [ ] Results update according to the selected month.

## Data

- Source: Google Sheet "My Zomato Food Pile", tab "Formatted Data", filled by the existing Apps
  Script. That workflow is preserved and not modified.
- The backend reads the sheet server-side (Phase 2). The frontend never sees credentials.

## Known artwork issues (to resolve in Phase 1)

| Issue                                                                           | Why it matters                                              | Options                                                                               |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `chai.png` has steam rising from the cup                                        | Conflicts with "no decorative effects emerge from the food" | Edit the steam out, or regenerate using `docs/design/upstream-sprite-style-guide.txt` |
| No `takeaway.png` fallback exists; the original app falls back to an emoji (🥡) | Emoji substitution is not allowed                           | Create a takeaway-box illustration, or exclude unmatched foods from the pile          |
| Upstream draws drop shadows and a hover "grow" effect on items                  | Not part of the approved design                             | Leave them out when porting                                                           |
| Upstream picture-matching rules (`CATS`) were written for Swiggy item names     | Zomato item names may map differently                       | Port the rules to `shared/`, then tune them against real sheet names (privately)      |
| Upstream loads the Outfit font from Google Fonts                                | Breaks the strict CSP and leaks page views to a third party | Self-host whichever font the design uses                                              |
