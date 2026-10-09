# Third-party notices

## My Food Pile

- Source: <https://github.com/sumitbedi/my-food-pile>
- Commit reviewed and copied from: `b9ddddc34f1f0562f8c8efc28ed4632509f592f0` (2026)
- What was copied, unmodified:
  - 27 food/object illustrations → `frontend/src/assets/food/*.png` (384×384 transparent PNG)
  - Illustration style guide → `docs/design/upstream-sprite-style-guide.txt`
- What is planned (Phase 1): adapting the physics/drop/outline logic from `app.js` into TypeScript.

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

## Matter.js (planned, Phase 1)

The original project bundles `matter-js` 0.20.0 (MIT, © Liam Brummitt). It is **not installed
yet**. When the animation is built it will be installed from npm (`matter-js@0.20.0`), and its
license ships inside the package.

## npm dependencies

All other dependencies are installed from npm and listed in `package-lock.json`; each package
carries its own license file.
