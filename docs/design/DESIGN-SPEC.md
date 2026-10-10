# Design specification

Source of truth: [`approved-design.png`](approved-design.png) (1584×993, owner-supplied example
with dummy data). Where this document and the image disagree, the image wins. Measurements are
approximate, read off the 1584 px-wide image, and will be refined during Phase 1 by comparing
screenshots side by side.

## Layout (desktop)

| Region      | Position                                                         | Contents                                                  |
| ----------- | ---------------------------------------------------------------- | --------------------------------------------------------- |
| Header      | Top-left, ~80 px from the left, ~45 px from the top              | Title + month pill on one line                            |
| Search      | Below the header, ~80 px → ~810 px wide                          | Input, thin underline, clear (×) button                   |
| Result      | Left column, under the search                                    | Count, food name, amount, three detail lines              |
| Plate       | Right half, roughly centred vertically between search and footer | One plated-dish illustration (~540 px wide)               |
| Footer pile | Full width, bottom ~22% of the viewport                          | Dense, overlapping food items, cut off by the bottom edge |

## Elements

- **Background:** warm off-white (≈ `#FBF8F3`).
- **Title:** "My **Zomato** food Stack". Heavy, rounded geometric sans-serif (~44 px, tight letter
  spacing). "My" and "food Stack" are near-black; "Zomato" is Zomato red (≈ `#E23744`).
- **Month selector:** pill (fully rounded), pale pink fill (≈ `#FCE8E6`), dark text
  "September 2026", chevron-down on the right. It sits on the same baseline row as the title.
- **Search input:** large, light-weight text (~36 px), near-black. Red caret. 1–2 px dark
  underline across the full field width. A thin × clear button at the right end, shown when the
  field has text.
- **Count:** very large (~150 px) red, bold (800), **upright** numeral (owner instruction: never
  italic or slanted), with small hand-drawn red "emphasis" strokes attached to each side.
  It is aligned with the food name below; on mobile it shifts right so the left strokes fit.
- **Food name:** bold, near-black (~38 px). Bracketed text is **removed** for display
  ("Tandoori Chicken (breast Pcs)" shows as "Tandoori Chicken"; owner instruction, Phase 1). The
  original name is still used for matching and kept unchanged in the data.
- **Amount:** "₹366 paid" in bold red (~44 px), in **whole rupees** (owner instruction). The exact
  paise total is rounded half up for display only (₹1,985.49 → ₹1,985; ₹1,985.50 → ₹1,986). A
  hand-drawn red underline sits under "paid".
- **Detail lines** (~19 px, grey text, red outline icons, ~44 px apart):
  1. pizza-slice icon: "From **{restaurant}**." (restaurant name in bold)
  2. clock icon: "Ordered on {d MMMM yyyy}."
  3. calendar icon: "Quantity: {n} ({k} order(s) this month)."
- **Plate:** one **photorealistic** plated dish that looks like the searched dish, on a white/cream
  plate with garnish, with a soft shadow under the plate only. No steam, sparkles or other effects.
  Without suitable artwork, a neutral empty plate is shown (see ART-BRIEF.md).
- **Footer pile:** many small food items, overlapping, colourful, all in the same illustrated style
  as the plate. Drinks with straws are fine.

## States

| State                              | Left column                                                        | Right side                             |
| ---------------------------------- | ------------------------------------------------------------------ | -------------------------------------- |
| Loading / opening drop             | Hidden until the drop has settled                                  | Empty                                  |
| No search                          | Search with animated placeholder                                   | **Empty**                              |
| Generic query, several foods match | “Which biryani are you looking for?” + one button per real variant | **Empty** (a question is not a result) |
| Search with matches                | Count, name, amount, details                                       | One plate (or a neutral empty plate)   |
| Search with no matches             | One quiet line: No orders for “…” in {Month}.                      | **Empty**, never an unrelated plate    |

## Decisions made in Phase 1

- **Font:** Outfit (variable, SIL OFL), self-hosted via `@fontsource-variable/outfit`.
- **Several matching orders:** the **most recent** matching line supplies the food name, restaurant
  and date. The count is the number of distinct orders; amount and quantity are totals for the
  selected month.
- **Month selector:** defaults to the latest month that has orders; "All months" is the last option.
- **Matching:** every typed word must match the start of a word in the item name, in any order
  ("chicken tandoori" finds "Tandoori Chicken"; "lassi" does not find "Classic").
- **Variants (Phase 2 refinement):** a food is a distinct display name ("Chicken Biryani (Serves 1)"
  ≡ "Chicken Biryani"). If the typed words exactly name one food (any order), or only one food
  matches, the result is shown directly. Otherwise the question lists up to 8 variants from the
  selected month, most-ordered first, with "N more matches. Keep typing…" for the rest. Picking a
  variant fills the search field with its name and returns focus there.
- **Mobile (≤ 760 px):** a single column; the plate sits below the result details; the pile stays
  at the bottom of the page.
