# Cast Studio v2

Multi-tenant digital casting and wardrobe library.

## Tech Stack

- **Backend**: Node.js + Express, TypeScript ESM
- **Frontend**: React + TypeScript + Vite
- **Database**: PostgreSQL
- **Image Generation**: fal.ai API
- **Image Storage**: fal.ai URLs (primary) + local backup (future: AWS S3)

## Quick Start

```bash
# Install dependencies (root installs all packages)
npm install

# Build shared types package
npm run build --workspace=packages/types

# Start both dev servers (Express :3001 + Vite :5173)
npm run dev
```

## Commands

| Command              | Description                    |
| -------------------- | ------------------------------ |
| `npm run dev`        | Start both dev servers         |
| `npm run dev:server` | Start Express on port 3001     |
| `npm run dev:client` | Start Vite on port 5173        |
| `npm run test`       | Run all test suites            |
| `npm run lint`       | Run ESLint across all packages |
| `npm run typecheck`  | TypeScript type checking       |
| `npm run build`      | Production build               |
| `npm run format`     | Format code with Prettier      |

## Project Structure

```
cast-studio-v2/
├── packages/types/    # Shared TypeScript types (@cast/types)
├── server/            # Express backend (port 3001)
├── client/            # React + Vite frontend (port 5173)
├── specs/             # Specification documents
├── docs/              # ADRs and documentation
└── .husky/            # Git pre-commit hooks
```

## Architecture

See `specs/spec.md` for the full system specification.
See `specs/implementation-plan.md` for the phased build plan.
See `docs/decisions/` for Architecture Decision Records.
