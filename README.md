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

# Set up environment
cp .env.example .env
# Edit .env with your DATABASE_URL, FAL_KEY, STRIPE_SECRET_KEY, etc.

# Run database migrations
cd server && npm run migrate:up

# Seed development data (optional)
npx tsx src/db/seed.ts

# Start both dev servers (Express :3001 + Vite :5173)
npm run dev
```

## Environment Variables

| Variable                | Description                   | Required     |
| ----------------------- | ----------------------------- | ------------ |
| `DATABASE_URL`          | PostgreSQL connection string  | Yes          |
| `FAL_KEY`               | fal.ai API key                | Yes          |
| `STRIPE_SECRET_KEY`     | Stripe secret key             | For payments |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | For payments |
| `RESEND_API_KEY`        | Resend API key                | For email    |
| `SESSION_SECRET`        | Session cookie signing secret | Recommended  |

## Commands

| Command                             | Description                    |
| ----------------------------------- | ------------------------------ |
| `npm run dev`                       | Start both dev servers         |
| `npm run dev:server`                | Start Express on port 3001     |
| `npm run dev:client`                | Start Vite on port 5173        |
| `npm run test`                      | Run all test suites            |
| `npm run test:server`               | Run backend tests only         |
| `npm run test:client`               | Run frontend tests only        |
| `npm run lint`                      | Run ESLint across all packages |
| `npm run typecheck`                 | TypeScript type checking       |
| `npm run build`                     | Production build               |
| `npm run format`                    | Format code with Prettier      |
| `cd server && npm run migrate:up`   | Run database migrations        |
| `cd server && npm run migrate:down` | Rollback database migrations   |

## Testing

```bash
# All tests (437 tests across 22 test files)
cd server && npm test

# Single test file
cd server && npx vitest run tests/integration.test.ts

# With coverage
cd server && npx vitest run --coverage
```

## Project Structure

```
cast-studio-v2/
├── packages/types/    # Shared TypeScript types (@cast/types)
├── server/            # Express backend (port 3001)
│   ├── src/
│   │   ├── db/        # Database pool, migrations, repositories
│   │   ├── middleware/ # Auth, workspace resolution
│   │   ├── routes/    # API route handlers
│   │   ├── services/  # Business logic
│   │   ├── workers/   # Background workers
│   │   └── server.ts  # Express app entry
│   └── tests/         # Backend test files
├── client/            # React + Vite frontend (port 5173)
├── specs/             # Specification documents
├── docs/              # ADRs and documentation (29 ADRs)
└── .husky/            # Git pre-commit hooks
```

## Architecture

See `specs/spec.md` for the full system specification.
See `specs/implementation-plan.md` for the phased build plan.
See `docs/decisions/` for Architecture Decision Records.
See `docs/CHANGELOG.md` for version history.

### Key Design Decisions

- **Multi-tenant**: All queries filter by `workspace_id` for complete isolation
- **Soft delete**: Assets use `deleted_at` timestamp, never hard-deleted
- **Versioning**: Regenerate archives old output, increments version, marks downstream obsolete
- **Async generation**: All image generation returns 202 immediately, background worker polls fal.ai
- **Dual auth**: Session cookies for web, Bearer tokens for API keys
- **Two-workspace model**: Studio (Artists/Admins) and Client (Clients) with sharing via `asset_permissions`
