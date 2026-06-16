# UI Design: Cast Studio v2

## Overview

React + TypeScript frontend. The app is a **single-page application** with client-side routing. All API calls go through a centralized API client. State management uses React Query for server state and Zustand for UI state.

## Tech Stack

- **Framework**: React 18 + TypeScript
- **Routing**: React Router v6
- **Server State**: TanStack Query v5 (React Query)
- **UI State**: Zustand
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui (Radix primitives)
- **Forms**: React Hook Form + Zod validation
- **Notifications**: Custom toast system + notification center

## Layout Structure

### App Shell

Every authenticated page uses the same shell:

```
+----------------------------------------------------------+
|  Top Bar: Logo | Workspace Switcher | Notifications | Avatar  |
+----------+-----------------------------------------------+
|          |                                               |
|  Sidebar |           Main Content Area                  |
|          |                                               |
|  Nav     |           (page content)                      |
|  Items   |                                               |
|          |                                               |
+----------+-----------------------------------------------+
```

### Sidebar Navigation

Collapsible sidebar. Icons + labels. Active state highlighted.

**Artist Sidebar:**
```
+--+
| D | Dashboard
| T | Tools
|   |   Actor Designer
|   |   Look Designer
|   |   Fashion Item Creator
| L | Library
|   |   Actors
|   |   Looks
|   |   Fashion Items
| C | Commissions
| S | Settings
+--+
```

**Client Sidebar:**
```
+--+
| D | Dashboard
| T | Tools
|   |   Actor Designer
|   |   Look Designer
|   |   Fashion Item Creator
| L | Library
|   |   Actors
|   |   Looks
|   |   Fashion Items
| C | Commissions
| S | Settings
+--+
```

**Admin Sidebar:**
```
+--+
| D | Dashboard
| T | Tools
|   |   Actor Designer
|   |   Look Designer
|   |   Fashion Item Creator
| L | Library
|   |   Actors
|   |   Looks
|   |   Fashion Items
| C | Commissions
| S | Settings
|   |   Users & Roles
|   |   Models
|   |   System Prompts
|   |   Actor Properties
|   |   Look Taxonomy
|   |   Fashion Item Taxonomy
|   |   Commission Forms
+--+
```

### Top Bar

- **Left**: App logo, workspace name badge
- **Center**: Global search (optional, Day One: skip)
- **Right**: Notification bell (with unread count), user avatar dropdown (profile, settings, logout)

---

## Page Definitions

### 1. Dashboard

**Layout**: Single scrollable page with two sections.

**Section 1 — Quick Actions**
Four cards in a row (responsive: 1 col mobile, 2 col tablet, 4 col desktop):

```
+------------+  +------------+  +------------+  +------------+
|  New Actor |  |  New Look  |  | New Item   |  | New Comm.  |
|  [+ Button] |  |  [+ Button]|  |  [+ Button]|  |  [+ Button]|
+------------+  +------------+  +------------+  +------------+
```

- Client sees all four. Artist sees first three (no commission creation). Admin sees first three.

**Section 2 — Recent Activity**
Horizontal scrollable list (capped at 10). Each card shows:
- Asset thumbnail
- Asset name
- Action type badge (Created, Generated, Shared, etc.)
- Timestamp (relative: "2h ago")

**Client additional section:**
- Wallet balance card (top-right): "Balance: 150.50 credits" + "Top Up" button

**Admin additional section:**
- Stats row: Total Actors | Total Looks | Total Items | Active Members | Pending Commissions

---

### 2. Actor Designer (Creation Flow)

This is a **multi-step wizard** with 3 stages.

#### Stage 1: Choose Entry Method

Four option cards in a grid:

```
+------------+  +------------+
| Structured |  | Reference  |
|    Form    |  |   Photo    |
| [Select]   |  |  [Select]  |
+------------+  +------------+

+------------+  +------------+
|  Raw Text  |  | Randomize  |
| [Select]   |  |  [Select]  |
+------------+  +------------+
```

**Structured Form**: Dynamic form rendered from admin-defined taxonomy fields (dropdowns, sliders, text inputs).

**Reference Photo**: Image upload area (drag-and-drop). On upload, vision model extracts features and pre-fills the form.

**Raw Text**: Single textarea for unrestricted prompt.

**Randomize**: System generates a grid of 6-8 random base identities. User clicks one to select, then proceeds.

#### Stage 2: Iterate & Select (Headshot → Fullshot → Expressions)

This is the core iteration loop. Each layout type is a **horizontal stepper**:

```
[Headshot ✓] → [Fullshot ✓] → [Expressions ✓] → [Next: Remaining Assets]
```

**For each step:**

```
+--------------------------------------------------+
|  Headshot                              Step 1/3   |
+--------------------------------------------------+
|                                                  |
|  +--------+  +--------+  +--------+  +--------+  |
|  | img 1  |  | img 2  |  | img 3  |  | img 4  |  |
|  | [✓]    |  | [ ]    |  | [ ]    |  | [ ]    |  |
|  +--------+  +--------+  +--------+  +--------+  |
|                                                  |
|  [Regenerate]  [Confirm Selection →]             |
+--------------------------------------------------+
```

- Grid of generated options (2x2 or 1x4 depending on screen size)
- Radio/click to select one
- "Regenerate" creates new options (replaces current set)
- "Confirm Selection" locks the choice and advances to next step
- Only the **selected** output is saved as SUCCESS. Others are discarded.

**After all three steps (headshot, fullshot, expressions) are confirmed:**

#### Stage 3: Name & Save

```
+--------------------------------------------------+
|  Name Your Actor                                 |
+--------------------------------------------------+
|  [Auto-generated name] [Edit]                    |
|                                                  |
|  Properties:                                     |
|  Age: [25]  Gender: [Female]  Vibe: [Cyberpunk] |
|  (dynamic fields from admin taxonomy)            |
|                                                  |
|  [Save Actor]                                    |
+--------------------------------------------------+
```

On save, the actor is created in the database and the Actor Page opens.

---

### 3. Actor Page

The main view for a single actor and all its assets.

```
+--------------------------------------------------+
|  [Edit Fields]  [Generate Look]                  |
+--------------------------------------------------+
|                                                  |
|  +------------------+  +----------------------+   |
|  |                  |  | Name: Cyberpunk Woman|   |
|  |   HEADSHOT       |  | Age: 25              |   |
|  |   (large)        |  | Gender: Female       |   |
|  |                  |  | Vibe: Cyberpunk      |   |
|  +------------------+  +----------------------+   |
|                                                  |
+--------------------------------------------------+
|  HEADSHOT                                        |
|  +--------+  +--------+                          |
|  | img 1  |  | img 2  |   [Regenerate] [Edit]   |
|  | [✓sel] |  |        |                          |
|  +--------+  +--------+                          |
+--------------------------------------------------+
|  FULLSHOT                                        |
|  +--------+  +--------+                          |
|  | img 1  |  | img 2  |   [Regenerate] [Edit]   |
|  | [✓sel] |  |        |                          |
|  +--------+  +--------+                          |
+--------------------------------------------------+
|  EXPRESSIONS                                     |
|  +--------+  +--------+                          |
|  | img 1  |  | img 2  |   [Regenerate] [Edit]   |
|  | [✓sel] |  |        |                          |
|  +--------+  +--------+                          |
+--------------------------------------------------+
|  EDITORIAL                                       |
|  [Generate]  [Generate New]                      |
|  (empty state if none generated)                 |
+--------------------------------------------------+
|  CHARACTER SHEET                                 |
|  Select Look: [Dropdown ▼]  [Generate]           |
|  (empty state if none generated)                 |
+--------------------------------------------------+
```

**Key behaviors:**
- Each asset type section is collapsible
- Obsolete assets show a banner: "This asset is based on a previous version of the Headshot. [Regenerate]"
- "Edit" on headshot/fullshot/expressions opens an inline edit mode (re-generates with modified prompt)
- "Generate" creates new outputs (for types that support multiples like editorial)
- Character Sheet section shows a Look selector dropdown (populated from workspace Look library)

---

### 4. Look Designer (Creation Flow)

Two-step flow.

#### Step 1: Choose Input Method

Three option cards:

```
+------------+  +------------+  +------------+
|  Prompt    |  | Reference  |  |  Compose   |
| [Select]   |  |  [Select]  |  |  [Select]  |
+------------+  +------------+  +------------+
```

**Prompt**: Textarea describing the look.

**Reference**: Image upload. Vision model extracts clothing pieces:

```
+--------------------------------------------------+
|  Reference Image: [uploaded image]               |
+--------------------------------------------------+
|  Extracted Pieces:                               |
|  [✓] Black Jacket   [✓] White Shirt             |
|  [✓] Black Pants    [ ] Brown Shoes             |
|  [✓] Silver Watch   [ ] Black Belt             |
|                                                  |
|  [Generate Look with Selected Pieces →]          |
+--------------------------------------------------+
```

**Compose**: Multi-select from Fashion Item library (thumbnail grid with checkboxes).

#### Step 2: Select & Name

```
+--------------------------------------------------+
|  Generated Options                               |
+--------------------------------------------------+
|  +--------+  +--------+  +--------+  +--------+  |
|  | img 1  |  | img 2  |  | img 3  |  | img 4  |  |
|  | [✓]    |  | [ ]    |  | [ ]    |  | [ ]    |  |
|  +--------+  +--------+  +--------+  +--------+  |
|                                                  |
|  [Regenerate]                                    |
+--------------------------------------------------+
|  Name: [Auto-generated name] [Edit]              |
|  [Save Look]                                     |
+--------------------------------------------------+
```

---

### 5. Fashion Item Creator (Creation Flow)

Two-step flow.

#### Step 1: Choose Input Method

Two option cards:

```
+------------+  +------------+
|  Prompt    |  | Reference  |
| [Select]   |  |  [Select]  |
+------------+  +------------+
```

**Prompt**: Textarea describing the item.

**Reference**: Image upload. Vision model extracts the item.

#### Step 2: Select & Name

Same as Look Designer — grid of options, select one, auto-name, save.

---

### 6. Asset Libraries

All three libraries share the same layout pattern:

```
+--------------------------------------------------+
|  Actors                              [+ New Actor]|
+--------------------------------------------------+
|  Filters                                             |
|  [Shared with Me ▼] [Age ▼] [Gender ▼] [Vibe ▼]  |
|  [Style ▼] [Creator ▼] [Date ▼] [Reset]          |
+--------------------------------------------------+
|                                                  |
|  +--------+  +--------+  +--------+  +--------+  |
|  |thumb   |  |thumb   |  |thumb   |  |thumb   |  |
|  |name    |  |name    |  |name    |  |name    |  |
|  |tags    |  |tags    |  |tags    |  |tags    |  |
|  +--------+  +--------+  +--------+  +--------+  |
|                                                  |
|  +--------+  +--------+  +--------+  +--------+  |
|  |thumb   |  |thumb   |  |thumb   |  |thumb   |  |
|  |name    |  |name    |  |name    |  |name    |  |
|  |tags    |  |tags    |  |tags    |  |tags    |  |
|  +--------+  +--------+  +--------+  +--------+  |
|                                                  |
|  [< 1 2 3 >]                                     |
+--------------------------------------------------+
```

**Card structure:**
- Thumbnail image (headshot for actors, look image for looks, item image for fashion items)
- Name below thumbnail
- Small tags/categories below name
- Hover: quick actions overlay (view, share if artist)

**Filter sidebar:**
- Collapsible filter panel on the left (or top on mobile)
- Filter groups match taxonomy categories
- "Shared with Me" toggle at the top (Client workspace only)
- Active filters shown as removable chips above the grid
- "Reset All" button

**Empty state:**
```
+--------------------------------------------------+
|              [Empty Illustration]                |
|                                                  |
|              No actors yet                       |
|     Create your first actor to get started       |
|                                                  |
|              [+ New Actor]                       |
+--------------------------------------------------+
```

**Library differences:**

| | Actor Library | Look Library | Fashion Item Library |
|---|---|---|---|
| Card image | Headshot | Look image | Item image |
| Default sort | Newest | Newest | Newest |
| Filters | Actor properties (admin taxonomy) | Gender, Style, Season, Color, Occasion | Gender, Item Type, Sub-type, Style, Color, Season |
| "Shared with Me" | ✓ (Client) | ✓ (Client) | ✓ (Client) |
| Quick action | View Actor | View Look | View Item |

---

### 7. Commissions

#### Client View: My Commissions

```
+--------------------------------------------------+
|  My Commissions                      [+ New]      |
+--------------------------------------------------+
|  [All] [Requested] [In Review] [Approved]        |
+--------------------------------------------------+
|  +----------------------------------------------+ |
|  | 🔵 Need cyberpunk actor for editorial        | |
|  |    Status: SUBMITTED • Submitted 2h ago      | |
|  |    Assigned to: Jane Artist                  | |
|  |    [View Details]                             | |
|  +----------------------------------------------+ |
|  +----------------------------------------------+ |
|  | 🟢 Fashion lookbook for summer               | |
|  |    Status: APPROVED • Approved 1d ago        | |
|  |    [View Details]                             | |
|  +----------------------------------------------+ |
+--------------------------------------------------+
```

#### Artist View: Assigned Commissions

```
+--------------------------------------------------+
|  My Commissions                                  |
+--------------------------------------------------+
|  [All] [Assigned] [In Progress] [Submitted]      |
+--------------------------------------------------+
|  +----------------------------------------------+ |
|  | 🟡 Need cyberpunk actor for editorial        | |
|  |    Status: IN PROGRESS • Assigned 3h ago     | |
|  |    From: Brand Client                        | |
|  |    [View Brief] [Submit Work]                | |
|  +----------------------------------------------+ |
+--------------------------------------------------+
```

#### Admin View: All Commissions

```
+--------------------------------------------------+
|  All Commissions                                 |
+--------------------------------------------------+
|  [All] [Requested] [Assigned] [In Progress]      |
|  [Submitted] [Approved] [Cancelled]              |
+--------------------------------------------------+
|  +----------------------------------------------+ |
|  | 🔴 Need cyberpunk actor for editorial        | |
|  |    Status: REQUESTED • 5m ago                | |
|  |    From: Brand Client                        | |
|  |    [Assign to Artist/Agent]                  | |
|  +----------------------------------------------+ |
+--------------------------------------------------+
```

#### Commission Detail Page

```
+--------------------------------------------------+
|  ← Back to Commissions                           |
+--------------------------------------------------+
|  Need cyberpunk actor for editorial              |
|  Status: SUBMITTED                               |
+--------------------------------------------------+
|  Brief                                           |
|  +----------------------------------------------+ |
|  | Project Type: Editorial                      | |
|  | Style: Cyberpunk                             | |
|  | Reference Images: [img1] [img2]              | |
|  | Notes: Looking for a young female actor...   | |
|  +----------------------------------------------+ |
+--------------------------------------------------+
|  Submitted Work                                 |
|  +--------+  +--------+                          |
|  |thumb   |  |thumb   |   [Approve] [Changes]   |
|  |name    |  |name    |                          |
|  +--------+  +--------+                          |
+--------------------------------------------------+
|  Premium Cost: 5.00 credits                      |
|  [Approve & Unlock]                              |
+--------------------------------------------------+
```

---

### 8. Settings

#### Artist Settings

```
+--------------------------------------------------+
|  Settings                                        |
+--------------------------------------------------+
|  Profile                                         |
|  Name: [Jane Artist]                              |
|  Email: [jane@studio.com]                        |
|  [Save Changes]                                  |
+--------------------------------------------------+
|  API Keys (if API-enabled)                       |
|  +----------------------------------------------+ |
|  | Production Agent  cs_live_abc...xyz  [Copy]  | |
|  | Last used: 2h ago                            | |
|  | [Revoke]                                     | |
|  +----------------------------------------------+ |
|  | [+ New API Key]                              | |
+--------------------------------------------------+
```

#### Client Settings

```
+--------------------------------------------------+
|  Settings                                        |
+--------------------------------------------------+
|  Profile                                         |
|  Name: [Brand Client]                             |
|  Email: [client@brand.com]                       |
|  [Save Changes]                                  |
+--------------------------------------------------+
|  Wallet                                          |
|  Balance: 150.50 credits                         |
|  [Top Up]                                        |
+--------------------------------------------------+
|  Recent Transactions                             |
|  -0.05  CHARGE   Headshot generation   2h ago    |
|  +100.00 TOP_UP   Top-up             1d ago     |
|  [View All →]                                    |
+--------------------------------------------------+
```

#### Admin Settings

```
+--------------------------------------------------+
|  Settings                                        |
+--------------------------------------------------+
|  [Users & Roles] [Models] [System Prompts]       |
|  [Actor Properties] [Look Taxonomy]              |
|  [Fashion Item Taxonomy] [Commission Forms]      |
+--------------------------------------------------+
|  (content changes per tab)                       |
+--------------------------------------------------+
```

**Users & Roles tab:**
- Table of all accounts across all workspaces
- Columns: Name, Email, Role, Workspace, API Enabled, Actions
- Actions: Edit role, Toggle API access, Deactivate

**Models tab:**
- Table of configured models
- Columns: Name, Model ID, Type, Task, Active, Actions
- Actions: Edit parameters, Toggle active, Delete
- [+ Add Model] button → opens fal.ai model browser

**System Prompts tab:**
- List of prompt templates grouped by task
- Each shows: Task name, Template preview, Last modified
- Click to edit in a code/text editor

**Taxonomy tabs (Actor Properties, Look Taxonomy, Fashion Item Taxonomy):**
- List of taxonomy entries grouped by category
- Each shows: Key, Label, Input Type, Required, Active
- Actions: Edit, Reorder, Toggle active, Delete
- [+ Add Entry] button

**Commission Forms tab:**
- List of form templates
- Each shows: Name, Fields count, Active
- Actions: Edit fields, Toggle active, Delete
- [+ New Form] button

---

### 9. Generation Status Component

A reusable component used across all pages that shows async generation progress.

**PENDING state:**
```
+--------------------------------------------------+
|  ⟳ Generating headshot...                        |
|  [=========>          ] 60%                      |
+--------------------------------------------------+
```

Or simpler (no progress bar, just status):
```
+--------------------------------------------------+
|  ⟳ Generating...  [View Status →]                |
+--------------------------------------------------+
```

**SUCCESS state:**
```
+--------------------------------------------------+
|  ✓ Generation complete • 15s                     |
+--------------------------------------------------+
```

**FAILED state:**
```
+--------------------------------------------------+
|  ✗ Generation failed: Model timeout               |
|  [Retry]                                         |
+--------------------------------------------------+
```

---

### 10. Notification Center

Dropdown from the top-right notification bell:

```
+--------------------------------------------------+
|  Notifications                         [Mark All] |
+--------------------------------------------------+
|  🔵 New commission assigned                      |
|     "Need cyberpunk actor"          5m ago       |
|  ─────────────────────────────────────────────── |
|  🔵 Work submitted for review                    |
|     "Cyberpunk Woman headshot"      2h ago       |
|  ─────────────────────────────────────────────── |
|  ⚪ Commission approved                          |
|     "Fashion lookbook"              1d ago       |
+--------------------------------------------------+
|  [View All Notifications →]                      |
+--------------------------------------------------+
```

Unread notifications have a blue dot. Clicking navigates to the relevant page.

---

## Component Library

### Shared Components

| Component | Purpose |
|---|---|
| `AppShell` | Sidebar + top bar + main content layout |
| `Sidebar` | Navigation sidebar with collapsible groups |
| `TopBar` | Logo, workspace badge, notifications, avatar |
| `PageHeader` | Page title + optional action buttons |
| `EmptyState` | Illustration + message + action button |
| `LoadingState` | Skeleton loaders matching content shape |
| `ErrorState` | Error message + retry button |
| `ConfirmDialog` | Confirmation modal for destructive actions |
| `StatusBadge` | Colored badge for statuses (PENDING, SUCCESS, etc.) |
| `GenerationCard` | Shows generation progress/result |
| `AssetCard` | Thumbnail + name + tags + hover actions |
| `FilterPanel` | Collapsible filter sidebar |
| `Pagination` | Page navigation controls |
| `Toast` | Notification toasts (success, error, info) |
| `NotificationDropdown` | Notification center dropdown |
| `ModelSelector` | Dropdown for model selection (Artist only) |
| `SettingsSlider` | Slider for generation settings |
| `TaxonomyForm` | Dynamic form rendered from taxonomy entries |
| `ImageUpload` | Drag-and-drop image upload with preview |
| `ImageGrid` | Grid of selectable images (for generation options) |
| `Stepper` | Horizontal step indicator (for creation wizards) |
| `WalletBalance` | Balance display + top-up button |
| `DataTable` | Generic sortable/filterable data table (Admin) |

---

## State Management

### Server State (React Query)

All API data is managed by React Query with the following query key patterns:

```
['actors']                    — actor list (with filters in query)
['actors', id]                — single actor with outputs
['looks']                     — look list
['looks', id]                 — single look
['fashion-items']              — fashion item list
['fashion-items', id]          — single fashion item
['commissions']                — commission list (filtered by role)
['commissions', id]            — single commission with assets
['workflows', id]              — workflow status
['notifications']              — notification list
['notifications', 'unread']    — unread count
['wallet']                     — wallet balance
['dashboard']                  — dashboard data
['models']                     — available models
['taxonomy', category]         — taxonomy entries
['prompts']                    — system prompts
```

### UI State (Zustand)

```
useUIStore
  ├── sidebarCollapsed: boolean
  ├── activeModal: string | null
  ├── toastQueue: Toast[]
  └── theme: 'light' | 'dark' (future)
```

### URL State

Filters and pagination are synced to URL search params for shareability:

```
/actors?page=1&gender=female&style=cyberpunk
/commissions?status=SUBMITTED
```

---

## Routing

```
/                           → Dashboard
/actors                     → Actor Library
/actors/new                 → Actor Designer (creation wizard)
/actors/:id                 → Actor Page
/looks                      → Look Library
/looks/new                  → Look Designer
/looks/:id                  → Look Detail
/fashion-items              → Fashion Item Library
/fashion-items/new          → Fashion Item Creator
/fashion-items/:id          → Fashion Item Detail
/commissions                → Commissions list
/commissions/new            → New Commission form
/commissions/:id            → Commission Detail
/settings                   → Settings
  /settings/api-keys        → API Keys (Artist)
  /settings/wallet          → Wallet (Client)
  /settings/users           → Users & Roles (Admin)
  /settings/models          → Models (Admin)
  /settings/prompts         → System Prompts (Admin)
  /settings/taxonomy/:cat → Taxonomy management (Admin)
  /settings/commission-forms → Commission Forms (Admin)
```

---

## Responsive Breakpoints

| Breakpoint | Width | Layout |
|---|---|---|
| Mobile | < 768px | Single column, bottom tab bar or hamburger menu |
| Tablet | 768-1024px | Sidebar collapsed (icons only), 2-col grids |
| Desktop | > 1024px | Full sidebar, 3-4 col grids |

---

## Accessibility

- All interactive elements keyboard accessible (Tab, Enter, Space)
- ARIA labels on icon-only buttons
- Form inputs always have associated labels
- Focus management in modals and wizards (focus trap, return focus on close)
- Skeleton loaders use `aria-busy="true"`
- Empty states use `role="status"`
- Color is never the sole indicator (always paired with text or icons)
- Minimum contrast ratio: 4.5:1 for text, 3:1 for large text
