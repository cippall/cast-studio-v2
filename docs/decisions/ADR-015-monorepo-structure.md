# ADR-009: Monorepo Structure with npm Workspaces

## Status

Accepted

## Date

2026-06-17

## Context

Cast Studio v2 requires a monorepo structure to share TypeScript types and interfaces between the backend (Express) and frontend (React) without duplication. Key requirements:

- Shared TypeScript types (`@cast/types`) must be importable from both `server/` and `client/`
- Both packages need independent build, test, and dev workflows
- Developer experience must be smooth — one command to start both dev servers
- Common tooling (ESLint, Prettier, TypeScript, husky) should be configured at root level but overridable per package

## Decision

Use **npm workspaces** with the following structure:

```
cast-studio-v2/          # root (private)
├── packages/types/      # @cast/types — shared TypeScript types
├── server/              # Express backend
├── client/              # React + Vite frontend
├── tsconfig.base.json   # Shared strict TypeScript config
├── .eslintrc.json       # Root ESLint config
├── .prettierrc          # Shared formatter config
└── .husky/              # Git hooks
```

### Key choices:

- **npm workspaces** over pnpm/yarn — simpler, zero extra tooling, works with npm 10 natively
- **TypeScript project references** — `server/` and `client/` both reference `packages/types/` via `references` in tsconfig.json, enabling type-checking across packages without build
- **`tsx watch` for server dev** — fast ESM TypeScript execution with auto-restart, simpler than ts-node-dev
- **Vite for client dev** — standard React + Vite with API proxy to Express
- **Root-level dev dependencies** — ESLint, Prettier, husky installed once at root, shared across all packages
- **`lint-staged` in pre-commit hook** — runs ESLint fix + Prettier on staged files

## Alternatives Considered

### pnpm workspaces

- Pros: Faster installs, stricter dependency isolation
- Cons: Extra tooling to install, incompatibility with some npm packages
- Rejected: Our monorepo is small (3 packages) — npm workspaces is sufficient

### Turborepo / Nx

- Pros: Build caching, task orchestration, parallel execution
- Cons: Heavy tooling for a project of this size (3 packages at Phase 1)
- Rejected: Overengineered for current scope; can add later if needed

### Single package (no monorepo)

- Pros: Simplicity, no workspace overhead
- Cons: Duplicated types, no shared code, messy dependency management
- Rejected: The spec explicitly requires shared types at `@cast/types`

## Consequences

- Shared types are written once in `packages/types/src/` and consumed by both packages as `@cast/types`
- TypeScript strict mode is enforced via `tsconfig.base.json` across all packages
- Running `npm run dev` at root starts both dev servers concurrently
- Pre-commit hooks with lint-staged enforce code quality on every commit
- Adding new shared packages or libraries is straightforward
