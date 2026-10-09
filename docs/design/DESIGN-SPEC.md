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
- **Count:** very large (~150 px) red, heavy italic/brush-style numeral, with small hand-drawn red
  "emphasis" strokes on both sides.
- **Food name:** bold, near-black (~38 px). Shows the **original** item name, brackets included
  (e.g. "Tandoori Chicken (breast Pcs)").
- **Amount:** "₹366.04 paid" in bold red (~44 px), always with two decimals. A hand-drawn red
  underline sits under "paid".
- **Detail lines** (~19 px, grey text, red outline icons, ~44 px apart):
  1. pizza-slice icon: "From **{restaurant}**." (restaurant name in bold)
  2. clock icon: "Ordered on {d MMMM yyyy}."
  3. calendar icon: "Quantity: {n} ({k} order(s) this month)."
- **Plate:** one realistic, illustrated plated dish on a white/cream plate with garnish, with a soft
  natural shadow under the plate only. No steam, sparkles or other effects.
- **Footer pile:** many small food items, overlapping, colourful, all in the same illustrated style
  as the plate. Drinks with straws are fine.

## States

| State                  | Left column                         | Right side                          |
| ---------------------- | ----------------------------------- | ----------------------------------- |
| Loading / opening drop | Hidden until the drop has settled   | Empty                               |
| No search              | Search with animated placeholder    | **Empty**                           |
| Search with matches    | Count, name, amount, details        | One plate                           |
| Search with no matches | To be decided in Phase 1 (e.g. "0") | **Empty**, never an unrelated plate |

## Open questions for Phase 1

- Exact font (candidates to self-host: a heavy rounded geometric sans such as Outfit, Plus Jakarta
  Sans or Satoshi). To be confirmed against the image.
- Which matching line provides the food name, restaurant and date when several orders match (for
  example, the most recent order).
- Mobile layout (the image shows desktop only).
