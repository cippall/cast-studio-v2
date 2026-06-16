# Changelog

## [Unreleased]

### Architecture Decisions
- ADR-001: Tech stack selected (Node.js/Express, React, PostgreSQL, fal.ai, Stripe, Resend)
- ADR-002: PostgreSQL chosen as primary database with UUID PKs and JSONB fields
- ADR-003: Dual auth system (session cookies for web, API keys for programmatic access)
- ADR-004: Workspace isolation via `workspace_id` on all tables with admin bypass
- ADR-005: Async image generation pipeline with background worker and version archiving
- ADR-006: `client_id` as single source of truth for asset ownership
- ADR-007: Marketplace freeze mechanism for approved listings
- ADR-008: Asset output versioning with archive table and dependency chain invalidation

### Project Setup
- Monorepo structure: `server/`, `client/`, `packages/types/`
- Implementation plan: 28 tasks across 5 phases
- Agent profiles: backend-dev and frontend-dev configured for v2
- AGENTS.md: Agent operating contract with required skills and execution rules
