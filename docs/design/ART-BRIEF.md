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

## Required files (exact names)

The app recognises exactly these category names. They're defined in
`shared/src/lib/food-category.ts`, which also holds the rules that decide which category an
order's item name belongs to. Drop `assets/pile/<name>.png` and/or `assets/plates/<name>.png` and
they replace the stand-in on the next build; no code changes are needed.

| Name               | Example item names it covers                     | Temporary stand-in today |
| ------------------ | ------------------------------------------------ | ------------------------ |
| `tandoori-chicken` | Tandoori Chicken, Paneer Tikka, Seekh Kebab      | `fried-chicken.png`      |
| `fried-chicken`    | Fried Chicken, Wings, Drumsticks                 | `fried-chicken.png`      |
| `curry`            | Butter Chicken, Dal Makhani, Chole, Tikka Masala | none                     |
| `biryani`          | Biryani, Pulao, Fried Rice                       | `biryani.png`            |
| `noodles`          | Hakka Noodles, Chow Mein, Ramen                  | none                     |
| `momos`            | Momos, Dumplings, Dim Sum                        | none                     |
| `dosa-idli`        | Masala Dosa, Idly, Uttapam, Vada                 | `dosa.png`               |
| `pizza`            | Margherita, any "Pizza"                          | `pizza.png`              |
| `burger`           | any "Burger"                                     | `burger.png`             |
| `sandwich`         | Sandwich, Sub, Panini                            | `sandwich.png`           |
| `wrap-roll`        | Shawarma, Kathi Roll, Wrap, Frankie              | `shawarma.png`           |
| `samosa`           | Samosa, Kachori, Pakora                          | none                     |
| `fries`            | any "Fries"                                      | `fries.png`              |
| `cold-drink`       | Coke, Pepsi, Sprite, Thums Up, Mojito            | `coke.png`               |
| `lassi-shake`      | Lassi, Shake, Smoothie, Cold Coffee              | `lassi.png`              |
| `ice-cream`        | Ice Cream, Sundae, Kulfi                         | `ice-cream-cup.png`      |
| `brownie-cake`     | Brownie, Cake, Pastry, Cheesecake                | `cake.png`               |
| `donut`            | Donut, Doughnut                                  | none                     |
| `sweets`           | Rasmalai, Gulab Jamun, Jalebi, Halwa             | `rasmalai.png`           |

- **Plates matter most.** Until `plates/<name>.png` exists, the right side draws the small stand-in
  on a plain plate shape. Categories with no stand-in show **no plate at all**.
- An item whose name matches no category is left out of the pile and shows no plate, so no
  unrelated picture ever appears. A generic `takeaway` image is therefore **optional**. If you'd
  like unmatched items to appear in the pile as a takeaway box, say so and it can be added as a
  category.
- If your real orders contain foods that fit none of these (seen once Phase 2 connects the sheet),
  new categories can be added in one place.
