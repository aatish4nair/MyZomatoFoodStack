# Repository audit (Phase 0, 2026-10-09)

## Starting state

- The project folder `My Zomato Food Stack/` was **empty**: no files, hidden files, `.env` or
  credentials.
- It was **not a Git repository**, and no parent folder was one either.
- No existing copy of My Food Pile was found in the folder or its sibling folders.
- Tools: Node v26.5.0, npm 11.17.0, git 2.53.0, gh 2.87.2.

Nothing needed preserving, and nothing was deleted or overwritten. `git init -b main` was run
with the owner's approval. **No commits have been made.**

## Original project: My Food Pile

Cloned read-only into a temporary folder outside the project
(commit `b9ddddc34f1f0562f8c8efc28ed4632509f592f0`, 3 commits, author Sumit Bedi). None of its
code was executed.

| Area             | Finding                                                                                                                                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| License          | MIT © 2026 Sumit Bedi, so reuse is permitted with the notice kept (see `THIRD_PARTY_NOTICES.md`).                                                                                                                |
| Stack            | One `index.html` + one `app.js` (~510 lines, plain JS), no build step. Dev dependency `puppeteer-core` for QA only.                                                                                              |
| Physics          | Matter.js 0.20.0 (MIT), vendored as `vendor/matter.min.js`. Gravity 1.5, sleeping enabled, fixed 120 Hz steps.                                                                                                   |
| Drop animation   | All pieces are spawned above the viewport in random order and fall into a floor/wall box. The piece size is computed so the whole pile fills the bottom ~27% of the screen.                                      |
| Collision shapes | Each sprite is cropped to its opaque pixels, and a ~16-point convex hull is traced, so bodies collide like the picture looks. This is the most valuable part to reuse.                                           |
| Picture mapping  | `CATS`: regex on item name → sprite name + fallback shape. Unmatched items become `takeaway`.                                                                                                                    |
| Search           | Whole-word, plural-tolerant regex (`wordRe`), synonyms (`SYN`), exclusions (`NOT`), and restaurant-name fallback. It lifts **all** matching pieces into a block, which differs from our "one plate" requirement. |
| Artwork          | 27 PNGs, 384×384, transparent, consistent "glossy toy" style. A style guide/prompt (`sprites/PROMPTS.txt`) is included. `takeaway.png` is listed but **missing**.                                                |
| Placeholders     | Emoji drawn to a canvas for missing sprites. **Not allowed** in our design.                                                                                                                                      |
| Swiggy-specific  | `tools/swiggy-export.js`, `tools/build-orders.mjs`, `AGENTS.md` setup flow, `data/sample.json`. **Not reused** (our data comes from Google Sheets).                                                              |
| External calls   | Google Fonts (Outfit). Would need to be self-hosted under our CSP.                                                                                                                                               |

## Reuse decisions

| Item                                   | Decision                                                                                 | When    |
| -------------------------------------- | ---------------------------------------------------------------------------------------- | ------- |
| 27 sprites + style guide               | Copied unmodified (SHA-256 verified) to `frontend/src/assets/food/` and `docs/design/`   | Phase 0 |
| Matter.js                              | Install `matter-js@0.20.0` from npm, not the vendored file                               | Phase 1 |
| Crop + outline hull, drop/settle loop  | Port to TypeScript in `frontend/src/features/food-stack/`, with tests for the pure parts | Phase 1 |
| `CATS` / `SYN` / `NOT` matching rules  | Port as pure functions to `shared/`, with tests                                          | Phase 1 |
| Search "lift every match into a block" | Not reused. Replaced by "one representative plate".                                      | —       |
| Swiggy tools, QA scripts, AGENTS.md    | Not reused                                                                               | —       |

## Structural deviations from the requested tree

| Requested                                                                                                                                                      | Done instead                                                                              | Reason                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Empty folders such as `pages/`, `features/*`, `hooks/`, `services/`, `orders/`, `insights/`, `integrations/`, `schemas/`, `tests/e2e/`, `scripts/`             | Not created yet                                                                           | No content yet ("don't create empty directories"). They're documented as planned in ARCHITECTURE.md. |
| `backend/src/test/`, `frontend/src/test/` for tests                                                                                                            | Tests sit next to the code (`*.test.ts`). `frontend/src/test/` holds only the test setup. | Easier to find, and the conventional default for Vitest.                                             |
| Backend health route                                                                                                                                           | `backend/src/modules/health/`                                                             | The first real module.                                                                               |
| (not listed) `shared/src/lib/`                                                                                                                                 | Holds `toDisplayName()`                                                                   | Pure helper shared by both sides.                                                                    |
| (not listed) `docs/product/`, `docs/design/`, `THIRD_PARTY_NOTICES.md`, `tsconfig.base.json`, `eslint.config.js`, `vitest.config.ts`, `.nvmrc`, Prettier files | Added                                                                                     | Requirements, artwork provenance, license and shared tool config.                                    |
| TypeScript "latest" (7.0)                                                                                                                                      | 6.0.3                                                                                     | typescript-eslint supports only TypeScript below 6.1 (see ADR-0001).                                 |
