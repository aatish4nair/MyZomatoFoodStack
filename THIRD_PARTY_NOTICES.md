# Third-party notices

## My Food Pile

- Source: <https://github.com/sumitbedi/my-food-pile>
- Commit reviewed and copied from: `b9ddddc34f1f0562f8c8efc28ed4632509f592f0` (2026)
- What was copied, unmodified:
  - 27 food/object illustrations → `frontend/src/assets/food/*.png` (384×384 transparent PNG)
  - Illustration style guide → `docs/design/upstream-sprite-style-guide.txt`
- Adapted into TypeScript (Phase 1): the sprite crop and convex-outline tracing
  (`frontend/src/features/food-stack/sprite-shape.ts`) and the drop-and-settle approach
  (`pile-simulation.ts`). These are covered by the MIT notice below.

```
MIT License

Copyright (c) 2026 Sumit Bedi

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Matter.js

`matter-js` 0.20.0 (MIT, © Liam Brummitt), installed from npm as a frontend dependency. Its
license ships inside the package.

## Outfit font

`@fontsource-variable/outfit` 5.3.0: the Outfit typeface (© The Outfit Project Authors), licensed
under the SIL Open Font License 1.1. The license ships inside the package. The font files are
bundled and self-hosted.

## google-auth-library

`google-auth-library` 11.2.0 (© Google LLC), licensed under the Apache License 2.0. It is a backend
runtime dependency, used only to obtain read-only Google Sheets access tokens. The license ships
inside the package.

## npm dependencies

All other dependencies are installed from npm and listed in `package-lock.json`; each package
carries its own license file.
