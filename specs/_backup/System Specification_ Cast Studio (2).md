# **System Specification: Cast Studio v2**

## **Problem Statement**

How might we build a multi-tenant digital casting and wardrobe library that enables artists, external clients, and autonomous AI agents to generate, store, and track highly consistent multi-layout actor portfolios without relying on custom model training?

## **Recommended Direction**

Build Cast Studio as a deterministic, multi-tenant state machine driven by a unified PostgreSQL table architecture. Instead of traditional single-image generation, the engine orchestrates complex system prompts to generate structural layout portfolios containing identity headshots, relaxed full-shots, expression sheets, and template-driven editorial scenes.

The frontend uses a clean, non-cluttered input bar supporting multi-modal inputs (text, reference uploads, structural sliders, and randomized generation) to accommodate both curated mixing and full creator workflows. The business layer is powered by a granular, pay-per-click credit ledger for clients, complete with an elegant, non-duplicating asset bridge that manages visibility via a dynamic permission layer, enforcing an instantaneous hard cutoff if clients revoke studio permissions.

## **Architecture Decisions**

| Decision | Choice | Rationale |
| :---- | :---- | :---- |
| Database | PostgreSQL | Multi-tenant isolation, row-level security, JSONB for flexible prompt recipes, production-grade concurrency |
| Tenancy Model | Workspace-scoped | Every entity belongs to a workspace; all queries filtered by workspace_id |
| Asset Visibility | Permission table (not ENUM) | Fine-grained per-account grants with instant revocation — a simple ENUM cannot express per-client access control |
| Seed Storage | BIGINT | Seeds are integers; VARCHAR is misleading and prevents numeric operations |
| Billing Granularity | Per-output cost tracking | Each asset_output records its model and cost_credits for accurate pay-per-click ledger debiting |
| Ledger Traceability | workflow_id FK | Every escrow/refund entry links back to its originating workflow for audit trails |

## **Key Assumptions to Validate**

* **Multi-Layout System Prompting:** Layout-specific system prompts can reliably split a single inference call into structured expression grids and sheets without fracturing character facial features.
* **Real-Time Granular Ledger Tracking:** The transactional ledger can accurately capture and process pay-per-click deductions in real time during massive, asynchronous parallel API generation bursts.
* **Agentic Error Toleration:** Downstream autonomous agents utilizing dynamic generation can cleanly handle occasional flawed or blocked model rolls without breaking active production loops.

## **Full App Scope**

The Day One implementation requires the following core components to be fully functional.

### Component 1: Unified Table Database

| Feature | Description |
| :---- | :---- |
| Zero-Duplication Architecture | A single `assets` table with a nullable `client_id` pointer to bridge data across environments without file copying. |
| Dynamic Permission Layer | An `asset_permissions` table managing per-account visibility grants, handling instantaneous permission revocation (Hard Cutoff) for active generations. |
| Workspace Isolation | All entities scoped to a workspace via `workspace_id` FK. Every query filters by workspace. |
| Multi-Tenant Accounts | `accounts` table with workspace membership, supporting ADMIN, ARTIST, CLIENT, and AGENT roles. |

### Component 2: Multi-Layout Portfolio Engine

| Feature | Description |
| :---- | :---- |
| Portfolio Generators | Structured generation templates outputting Identity Headshots, Relaxed Fullshots, Expression Sheets, Character Sheets, and Editorial Scenes. |
| Multi-Modal Input UI | A unified, clean prompt interface that accommodates raw text, image reference uploads, parameter sliders, and randomization dice seamlessly. |
| Output Tracking | Each generated image stored in `asset_outputs` with layout type, model used, cost charged, and status. |

### Component 3: Dual-Track Credit Ledger

| Feature | Description |
| :---- | :---- |
| Pay-Per-Click Billing | Real-time row-level ledger logic that charges the wallet a micro-fee per generation click for self-serve clients. |
| Premium Unlock Bridge | A transactional gateway allowing clients to spend a flat premium credit sum to approve, unlock, and adopt commissioned assets built by internal artists. |
| Key-Bound API Routing | Direct billing assignment determined by API Key origin (Studio Key uses studio compute; Client Key draws from client wallet balances). |
| Pre-Flight Workflow Escrow | Agents must hit a `/workflow/start` endpoint with their complete structural step declaration. The engine calculates the maximum estimated cost based on the requested model and image volume, locking that sum entirely within the client's wallet before execution begins. |
| Automated Error Release | If a workflow fails, crashes, or terminates prematurely due to error, any unconsumed credits tied to the frozen escrow are instantly released back to the client's available balance. |

### Component 4: Agent Telemetry

| Feature | Description |
| :---- | :---- |
| Workflow Tracking | `workflows` table tracks autonomous loops, escrow budgets, and structured errors. |
| Error Semantics | Machine-readable error codes and human-readable reasons for every failure. |
| Agent Loop Resilience | Failed model rolls within a workflow are logged and skipped; the loop continues with remaining steps. |

## **Not Doing (and Why)**

* **Automated Quality Telemetry Filters:** The ledger will not build predictive vision-model checks to verify image aesthetics; clients and autonomous agents explicitly absorb the cost and risk of bad rolls under the pay-per-click model.
* **Soft Lock Data Archiving:** The system will not retain "ghost copies" or temporary caches of assets if a client revokes access; data security dictates an immediate, permanent hard pipe termination.
* **Custom Model Training / LoRA Pipelines:** Zero architectural allowance for local fine-tuning; consistency relies entirely on system prompting, prompt recipes, and foundational model reasoning.

## **Open Technical Questions**

* **Webhook Telemetry:** How will the API key routing mechanism cleanly handle external payment/top-up failures midway through an autonomous agent's loop?
* **Image Storage:** Cloud storage provider for generated images (S3-compatible, GCS, or self-hosted) — to be decided during implementation.
* **Inference Provider:** Which model API to use for image generation (fal.ai, Replicate, etc.) — to be decided during implementation.
