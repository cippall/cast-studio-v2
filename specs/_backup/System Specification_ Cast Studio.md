# Cast Studio

# **Intent**

## Outcome

A web app, API, and relational database acting as a "digital casting and wardrobe library." It allows users to generate, store, and reuse highly consistent AI character sheets (Actors), specific stylings (Looks), and isolated clothing (Fashion Items).

## User

A three-headed user base:

* Internal Artists: Creating and managing the library to brief.  
* External Clients: Generating their own assets to save time and budget.  
* Downstream AI Agents: Querying the API to pull approved assets directly into scene generation.

## Why Now

AI film production requires strict visual continuity. Currently, there is no centralized, reusable database to manage an actor's specific look and their recurring wardrobe pieces across different tools, creating a massive workflow bottleneck.

## Success Criteria

An artist or client can lock in an Actor, Look, or Fashion Item in the GUI, and an AI agent can successfully hit the API to pull those exact assets to generate a new scene using strictly Nano Banana 2 and ChatGPT Image 2\.

## Constraints

The system must flawlessly manage state and orchestrate API calls (including prompt templates, seed tracking, and reference injection) to achieve multi-angle consistency for both faces and clothing *without* relying on custom training.

## Out of Scope

* No DALL-E  
* No custom model training  
* No LoRA pipelines  
* No local GPU infrastructure management  
* No actual video generation (the system is strictly the asset generation and database engine)

# **System Specification**

A web app, API, and relational database acting as a "digital casting and wardrobe library." It allows users to generate, store, and reuse highly consistent AI character sheets (Actors), specific stylings (Looks), and isolated clothing (Fashion Items) without relying on custom model training, DALL-E, or local GPU infrastructure.

## 1\. Core Architecture & Libraries

The database architecture is designed to handle fluid boundaries for internal work while maintaining strict, secure walled gardens for external clients.

* The Studio Library: The internal repository for the agency. It is split by visibility:  
  * Public Assets: Actors, Looks, and Fashion Items that any artist has marked as public. These form a shared agency resource pool.  
  * Private Assets: Assets currently being workshopped, or kept as proprietary by a specific artist. Only visible to the creator and Admins.  
* The Client Library: Walled gardens owned by specific clients containing their approved and generated assets.  
* The Asset Bridge: The bi-directional protocol allowing artists to push assets to clients for review, and clients to share self-generated assets back to the studio for commissioned work.

## 2\. Roles, Permissions & Visibility Matrix

The system relies on a strict permissions hierarchy and introduces an Admin layer to oversee the studio's output.

| Feature / Role | Studio Admin | Internal Artist | External Client | AI Agent (via API)   |
| :---- | :---- | :---- | :---- | :---- |
| Generation Cost | Free / Unlimited | Free / Unlimited | Costs Credits | Depends on API Key origin |
| Prompt Control | Full raw access | Full raw access | Abstracted / Guided | Full programmatic access |
| Asset Creation | Yes | Yes (Internal or Client-bound) | Yes (Self-serve) | Yes (Dynamic generation) |
| Asset Visibility | ALL (Public, Private, Client) | Own Private, All Public, Assigned Client | Own Library, Studio-Shared | Bound by API Key scope |
| Approval Power | Can override any status | Submits to Client, or auto-approves internal | Approves Artist submissions | N/A |

## 3\. The Workflows (Studio & Client)

Cast Studio handles three distinct operational loops flawlessly.

### Workflow A: Internal R\&D / Sandbox (Client-less)

* Generate: The artist builds an Actor or Look using the full-control UI.  
* Toggle Visibility: The artist saves the asset as *Private* (for their own ongoing experimentation) or *Public* (adding it to the studio's shared resource pool for other artists to use).  
* Admin Oversight: Regardless of the artist's toggle, a Studio Admin can view, audit, or reassign these assets at any time.

### Workflow B: The Commission (Studio-to-Client)

* Generate: The Artist creates assets targeted for a specific client.  
* Submit: The Artist pushes the assets to the Client's dashboard (Status: Pending Review).  
* Review & Lock: The Client reviews and hits *Approve*. The asset moves to the Client Library and is locked for production use.

### Workflow C: The Self-Serve (Client-Led)

* Spend & Generate: The Client uses the simplified UI, spending their wallet credits to generate assets.  
* Auto-Lock: Because the client generated it themselves, the "Review" phase is bypassed. Hitting *Save* automatically sets the status to *Locked* in their Client Library.  
* Share: The Client toggles *Share with Studio* if they need the agency to utilize these assets for final scene production.

## 4\. The Credit Engine

To monetize the external client tier, Cast Studio requires a built-in ledger system.

* Wallets: Each Client account has a digital wallet tracking credit balances.  
* Transaction Ledger: Every API call triggered by a client through the GUI deducts a specific amount of credits based on the compute cost of the requested asset.  
* Frictionless Top-ups: Integration with a payment gateway allowing clients to refill their credit balance directly within the GUI.

## 5\. The Orchestration API (Agent Operations)

The API is a fully functional generative endpoint for downstream autonomous systems.

### Mode 1: Asset Retrieval (Calling)

* The Request: The agent hits the API with an Actor\_ID, Look\_ID, and a Scene\_Prompt.  
* The Execution: The Cast Studio engine compiles the exact seed, reference images, and prompt structure associated with those locked assets, orchestrates the generation, and returns the highly consistent final image (or the raw payload).

### Mode 2: Dynamic Generation (Creating)

* The Request: An agent sends an unassigned generation payload to the Cast Studio generation endpoint to dynamically create a new Actor or Fashion Item on the fly.  
* The Execution: Cast Studio processes the prompt, generates the asset, and returns the newly created Asset ID back to the agent.  
* Storage & Billing: If authenticated with a Client API Key, credits are deducted, and the asset is saved to the Client Library. If authenticated with a Studio API Key, it uses studio compute and saves to the Studio Library under the agent's profile.

# **System Blueprint: Cast Studio**

## Problem Statement

How might we build a complete, multi-tenant digital casting and wardrobe library that enables artists, external clients, and downstream AI agents to generate, store, and reuse highly consistent AI assets with strict visual continuity?

## Recommended Direction

Build Cast Studio as a unified, production-ready ecosystem consisting of a Multi-Tenant Web GUI, a Transactional Credit Ledger, and a Stateless Orchestration Engine.  
The system achieves strict visual continuity without custom model training or LoRAs by acting as a deterministic state machine. It intercepts, stores, and perfectly injects seeds, prompt templates, and multi-angle reference images into Nano Banana 2 and ChatGPT Image 2\. The data architecture maintains strict isolation between the Public/Private Studio Pools and secure Client Walled Gardens, exposing everything via a high-throughput API designed for autonomous AI agents.

## Key Assumptions to Validate (The Structural Bets)

* \[ \] Multi-Angle Determinism: Prompt templates, specific seed ranges, and reference-injection matrixes are sufficient to hold face and wardrobe consistency across 5+ disparate scene generations using strictly Nano Banana 2 and ChatGPT Image 2\.  
* \[ \] Client Autonomy: External corporate clients will actively utilize an abstracted/guided prompt UI and spend wallet credits for self-serve asset generation, rather than relying solely on manual artist commissions.  
* \[ \] Agent Execution Fluidity: Autonomous downstream AI agents can handle programmatic generation payloads (Mode 2\) and correctly interpret returned Asset IDs for real-time scene injection.

## Full App Scope (Everything Implemented Day One)

### 1\. The Core Orchestration Engine

* Seed & Template Database: Stored relational mappings of text prompts, exact seed strings, and structural templates mapped directly to specific Actors, Looks, and Fashion Items.  
* Reference Injection Layer: Pipeline that handles multi-image reference payloads to ensure multi-angle consistency for faces and clothing without model training.  
* Model Adapters: Strict, native API integration layers for Nano Banana 2 and ChatGPT Image 2\.

### 2\. Multi-Tenant Library Architecture

* Studio Library: Split-visibility engine allowing internal artists to toggle assets between Private (creator-only) and Public (shared agency pool).  
* Client Walled Gardens: Isolated, secure client libraries containing strictly approved or self-generated assets.  
* The Asset Bridge: A bi-directional protocol processing lifecycle states (Pending Review $\\rightarrow$ Locked) for artist-to-client handoffs and client-to-studio sharing.

### 3\. Roles & Permissions Infrastructure

* 4-Tier Matrix: Deep RBAC enforcement across Studio Admins, Internal Artists, External Clients, and AI Agents via API keys.  
* UI Abstraction: Full raw prompt access for Admins/Artists; guided, bounded prompt builders for Clients.  
* Administrative Oversight: Universal visibility, override, and asset re-assignment powers for Studio Admins.

### 4\. The Credit Ledger Engine

* Digital Wallets: Client-bound token/credit balances updated in real-time.  
* Transactional Ledger: Row-level audit logging that deducts precise compute credits immediately upon successful generative API calls.  
* Top-Up Integration: Embedded payment gateway allowing frictionless, self-serve credit refills inside the client dashboard.

### 5\. The Downstream Orchestration API

* Mode 1 (Asset Retrieval): GET/POST endpoint compiling Actor/Look IDs and scene prompts into a finalized generative payload.  
* Mode 2 (Dynamic Generation): Unassigned endpoint allowing AI agents to generate new assets on the fly, automatically billing the associated key and returning new Asset IDs.

## Strictly Out of Scope (The Guardrails)

* No DALL-E Integration: Zero development time allocated to OpenAI's DALL-E pipelines.  
* No Custom Model Training / LoRAs: Absolutely no pipeline architecture built for DreamBooth, LoRA training, or custom checkpoint merging.  
* No Local GPU Infrastructure: The system relies entirely on external, third-party API compute; no hosting or scaling of local inference engines.  
* No Video Generation Engine: Cast Studio is strictly an asset generation, consistency, and database engine; it does not generate video files.

## Open Technical Questions

* Orchestration Latency: What is the maximum acceptable API round-trip time for an autonomous agent invoking Mode 2 dynamic generation before a timeout occurs?  
* Credit Calculation: How will credit deduction handle failed or deeply flawed upstream model generations? Is there an automated verification layer to prevent billing clients for broken images?  
* Reference Degradation: How many sequential reference injections can an Actor undergo before visual anomalies or "AI drift" degrade the character's facial consistency?