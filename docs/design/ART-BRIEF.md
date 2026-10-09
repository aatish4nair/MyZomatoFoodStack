# Artwork brief (owner-supplied art)

**Decision (2026-10-09):** the owner will supply new artwork that matches `approved-design.png`.
The 27 My Food Pile sprites in `frontend/src/assets/food/` are a different style ("glossy toy"),
so they'll be used only as temporary placeholders while building and will be replaced.

## Two kinds of image

| Kind          | Used for                                    | Size                      | Folder (Phase 1)              |
| ------------- | ------------------------------------------- | ------------------------- | ----------------------------- |
| **Pile item** | The falling footer collage                  | 512×512 transparent PNG   | `frontend/src/assets/pile/`   |
| **Plate**     | The single dish on the right after a search | 1024×1024 transparent PNG | `frontend/src/assets/plates/` |

File names: lowercase, hyphenated, the same name for both kinds, e.g. `pile/biryani.png` and
`plates/biryani.png`.

## Rules for every image

1. Transparent background. No floor, no table and no background colour.
2. Same illustrated, realistic, warm style as the plate and footer in `approved-design.png`.
3. One subject, centred, fully visible (not cropped).
4. **No steam, smoke, sparkles, motion lines or anything coming off the food.**
5. No text, logos or brand names.
6. Pile items must still read clearly at about 60–90 px on screen, so use bold shapes and clear
   colours.
7. Plates: a three-quarter top-down view of a round cream/white plate with garnish, like the
   tandoori chicken example. A soft shadow under the plate is fine; nothing else.

## Starter list

These are the foods visible in the design's footer, plus common Indian delivery categories. The
final list should follow your **actual** order history. In Phase 2 I can produce a count of which
food categories appear in your sheet (category names only, no personal details) so you can
prioritise.

| Name               | Pile | Plate | Notes                                                 |
| ------------------ | :--: | :---: | ----------------------------------------------------- |
| `tandoori-chicken` |  ✓   |   ✓   | Plate already shown in the design                     |
| `pizza`            |  ✓   |   ✓   | Slice for pile, whole pizza for plate                 |
| `burger`           |  ✓   |   ✓   |                                                       |
| `momos`            |  ✓   |   ✓   | Steamer basket in the pile                            |
| `noodles`          |  ✓   |   ✓   | Bowl                                                  |
| `biryani`          |  ✓   |   ✓   |                                                       |
| `samosa`           |  ✓   |   ✓   |                                                       |
| `wrap-roll`        |  ✓   |   ✓   | Shawarma / kathi roll                                 |
| `fries`            |  ✓   |   ✓   |                                                       |
| `cold-drink`       |  ✓   |   ✓   | Glass with straw                                      |
| `donut`            |  ✓   |   ✓   |                                                       |
| `brownie-cake`     |  ✓   |   ✓   |                                                       |
| `curry`            |  ✓   |   ✓   | Paneer/chicken curry bowl                             |
| `dosa-idli`        |  ✓   |   ✓   |                                                       |
| `ice-cream`        |  ✓   |   ✓   |                                                       |
| `takeaway`         |  ✓   |   –   | **Required** fallback for unmatched items in the pile |

A food with no plate image never shows an unrelated plate. The right side stays empty instead.
