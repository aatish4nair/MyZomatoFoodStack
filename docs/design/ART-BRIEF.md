# Artwork brief (owner-supplied art)

**Direction (updated 2026-10-10):** **photorealistic food**: appetising food photography or
photorealistic renders of a real plated dish, with warm lighting, suited to the cream page. The dish
must look like **that dish**, not merely the same broad category (tandoori chicken is red-orange
and charred; Afghani chicken is creamy and pale; veg biryani has no chicken on top).

**Plate art (2026-10-11):** the owner supplies one image per dish, named after the dish as it
appears in the app (e.g. `Butter Naan.jpg`). The earlier interim `tandoori-chicken.png` crop has
been removed. The 16 My Food Pile images bundled from
`frontend/src/assets/food/` are **temporary, toy-style stand-ins**, used only where they show the
same dish.

## Two kinds of image

| Kind          | Used for                                    | Size                                                 | Folder                                                            |
| ------------- | ------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------- |
| **Plate**     | The single dish on the right after a search | Square, 1024×1024 or larger; PNG, JPEG, WebP or AVIF | `frontend/src/assets/plates/<Dish name>.<ext>` (or `<key>.<ext>`) |
| **Pile item** | The falling footer collage                  | 512×512 transparent PNG                              | `frontend/src/assets/pile/<key>.png`                              |

Files are picked up by name on the next build (or immediately in `npm run dev:frontend`). No code
changes are needed.

## Rules for every image

1. Pile items: transparent background (cut out). Plates: transparent, or a background close to the
   page colour `#FBF8F3`.
2. **Plates:** a three-quarter top-down view of one round cream/white plate or bowl with the dish and
   light garnish (e.g. tandoori chicken with green chutney, onion rings, lemon). A soft shadow under
   the plate only.
3. **No steam, smoke, sparkles, motion lines or anything coming off the food.**
4. No text, logos, brand names or watermarks; use only images you have the right to use.
5. Pile items: a single item, clearly readable at about 60–90 px.
6. Keep the plate within about **90% of the frame**: the outer edge of plate images is softly faded
   into the page.

## Art keys and fallbacks

Defined in `shared/src/lib/food-category.ts` (first matching rule wins). The app looks for, in order:

1. an image named after **the dish itself** (compared ignoring case, punctuation, "&"/"and", word
   order and pack sizes), or an owner-chosen alias in `PLATE_ALIASES`
   (`frontend/src/features/food-art/registry.ts`);
2. `plates/<key>.<ext>`, then a **category-level fallback** `plates/<parent>.<ext>`;
3. a stand-in that shows **exactly** this dish;
4. otherwise, a **neutral empty plate**. It never shows an unrelated dish.

| Key                | Example item names                         | Fallback (parent)         | Stand-in today      |
| ------------------ | ------------------------------------------ | ------------------------- | ------------------- |
| `tandoori-chicken` | Tandoori Chicken, Chicken Tandoori, Tangdi | —                         | none                |
| `afghani-chicken`  | Afghani / Malai / Tandoori Malai Chicken   | `chicken-curry` → `curry` | none                |
| `chicken-curry`    | Butter Chicken, Chicken Tikka Masala       | `curry`                   | none                |
| `chicken-tikka`    | Chicken Tikka, Chicken Seekh Kebab         | `kebab`                   | none                |
| `paneer-tikka`     | Paneer Tikka                               | `kebab`                   | none                |
| `kebab`            | Mutton Seekh Kebab, other tikka/kebab      | —                         | none                |
| `fried-chicken`    | Fried Chicken, Wings, Chicken 65           | —                         | `fried-chicken.png` |
| `chicken-biryani`  | Chicken Dum Biryani                        | `biryani`                 | `biryani.png`       |
| `mutton-biryani`   | Mutton Biryani                             | `biryani`                 | none                |
| `egg-biryani`      | Egg Biryani                                | `biryani`                 | none                |
| `veg-biryani`      | Veg / Paneer Biryani                       | `biryani`                 | none                |
| `biryani`          | Hyderabadi Biryani, Pulao                  | —                         | none                |
| `fried-rice`       | Fried Rice                                 | —                         | none                |
| `paneer-curry`     | Paneer Butter Masala, Kadai Paneer         | `curry`                   | none                |
| `dal`              | Dal Makhani, Dal Tadka                     | `curry`                   | none                |
| `curry`            | Chole, Rajma, Korma, other curries         | —                         | none                |
| `naan-roti`        | Butter Naan, Roti, Paratha                 | —                         | none                |
| `idli`             | Idly                                       | —                         | `idli.png`          |
| `dosa`             | Masala Dosa, Uttapam                       | —                         | `dosa.png`          |
| `vada`             | Medu Vada                                  | —                         | `vada.png`          |
| `momos`            | Momos, Dumplings                           | —                         | none                |
| `samosa`           | Samosa, Kachori, Pakora                    | —                         | none                |
| `pizza`            | any Pizza, Margherita                      | —                         | `pizza.png`         |
| `garlic-bread`     | Garlic Bread(sticks)                       | —                         | `garlic-bread.png`  |
| `burger`           | any Burger                                 | —                         | `burger.png`        |
| `sandwich`         | Sandwich, Sub, Panini                      | —                         | `sandwich.png`      |
| `wrap-roll`        | Shawarma, Kathi Roll, Wrap                 | —                         | `shawarma.png`      |
| `noodles`          | Hakka Noodles, Chow Mein                   | —                         | none                |
| `fries`            | Fries                                      | —                         | `fries.png`         |
| `cold-drink`       | Coke, Pepsi, Sprite, Mojito                | —                         | `coke.png`          |
| `lassi`            | Lassi                                      | —                         | `lassi.png`         |
| `shake-coffee`     | Shakes, Cold Coffee                        | —                         | none                |
| `ice-cream`        | Ice Cream, Sundae, Kulfi                   | —                         | `ice-cream-cup.png` |
| `brownie-cake`     | Brownie, Cake, Pastry                      | —                         | `cake.png`          |
| `donut`            | Donut                                      | —                         | none                |
| `rasmalai`         | Rasmalai                                   | —                         | `rasmalai.png`      |
| `sweets`           | Gulab Jamun, Jalebi, Halwa                 | —                         | none                |

## What YOUR data needs

Run `npm run art:coverage`. It writes `private/art-coverage.md` (Git-ignored; it contains your food
names) listing **the dishes that still have no image of their own**, every art key your orders use
and the foods that match no key. The terminal shows totals only.

Status on 2026-10-11: **37 of 77** dishes have their own image (38 including aliases).
