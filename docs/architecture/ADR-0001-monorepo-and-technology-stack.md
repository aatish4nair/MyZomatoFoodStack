# ADR-0001: Monorepo and technology stack

- **Status:** Accepted
- **Date:** 2026-10-09
- **Decider:** Project owner (sole developer)

## Context

My Zomato Food Stack is a single-user, personal web app. It shows private order history (read from
a Google Sheet) as an animated food pile with search. Requirements that shape the architecture:

- Google credentials and order data must stay server-side, so a backend is needed even though the
  UI is the main product.
- One developer, who is learning, so the setup must have few moving parts and good documentation.
- Frontend and backend share data shapes, so a single shared contract avoids drift.
- The original [My Food Pile](https://github.com/sumitbedi/my-food-pile) (MIT, plain JS +
  Matter.js) provides the artwork and the physics approach.

## Decision

1. **One repository, npm workspaces** (`shared`, `backend`, `frontend`) with one root
   `package-lock.json`.
2. **Frontend:** React 19 + Vite 8 + TypeScript (strict). Plain CSS with design tokens. State lives
   in React state/hooks. Matter.js 0.20.0 (from npm, Phase 1) for physics.
3. **Backend:** Node.js 24 LTS + Fastify 5 + TypeScript, with `@fastify/helmet`, `@fastify/cors`
   and `@fastify/rate-limit`.
4. **Contracts:** Zod 4 schemas in `shared/`. TypeScript types are inferred from them, so each
   shape is defined once and checked both at compile time and at runtime.
   `fastify-type-provider-zod` applies these schemas to API requests and responses.
5. **Quality tooling:** ESLint 10 + typescript-eslint (`strictTypeChecked`), Prettier, Vitest 5
   (one run covers all packages), React Testing Library + jsdom. Playwright arrives with the
   first end-to-end test.
6. **TypeScript 6.0.3, not 7.x.** _(Deviation from "latest".)_ TypeScript 7.0 (the native
   compiler) is the current release, but `typescript-eslint` 8.71 supports only
   `typescript >=4.8.4 <6.1.0`. Type-aware linting is worth more than compiler speed here. Revisit
   when typescript-eslint supports TS 7.
7. **Hardening defaults:** `.npmrc` sets `ignore-scripts=true` (no dependency install scripts),
   `save-exact=true` and `engine-strict=true`.

## Alternatives considered

| Alternative                                           | Why not                                                                                                                       |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Keep the original plain HTML/JS app and add a backend | No types or tests, and hard to grow. We still reuse its assets and algorithms.                                                |
| Frontend only, reading a published sheet/CSV          | Exposes private data publicly. Rejected on security grounds.                                                                  |
| Next.js (full-stack React)                            | More framework than needed, and it mixes server and client code in one tree, which makes the security boundary harder to see. |
| Express instead of Fastify                            | Fastify has built-in schema validation hooks, a faster logger with redaction, and maintained security plugins.                |
| TypeBox/Ajv or Valibot instead of Zod                 | All viable. Zod has the widest ecosystem and a maintained Fastify type provider.                                              |
| pnpm / Turborepo / Nx                                 | Useful at scale. For three packages, npm workspaces is enough and needs no extra tools.                                       |
| Separate repositories per package                     | Contract changes would need coordinated releases. That's too much overhead for one person.                                    |

## Consequences

- **Positive:**
  - A single `npm ci` installs everything, and a single `npm run check` mirrors CI.
  - Shared schemas make API drift a compile-time or test-time failure.
  - The security boundary is visible in the folder structure and enforced by lint rules.
- **Negative:**
  - Several tsconfig files per package (a type-check config and a build config) and a custom
    `source` export condition. These are explained in `ARCHITECTURE.md` §6.
  - Pinning TypeScript to 6.0 means a deliberate upgrade later.
  - `ignore-scripts=true` could break a future dependency that truly needs an install script. If
    that happens, it will be handled case by case and recorded.
- **Follow-ups:** an ADR for access control (needed before internet deployment) and one for
  hosting.
