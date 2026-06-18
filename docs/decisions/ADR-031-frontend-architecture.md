# ADR-016: Frontend Architecture — App Shell + Routing

## Status

Accepted

## Date

2026-06-17

## Context

Task 22 of the implementation plan calls for the Frontend Foundation — the app shell, sidebar, routing, state management, auth flow, and API client. This is the first frontend work in the project, so all architectural patterns established here will propagate to every subsequent frontend task.

Key requirements from the UI spec:

- Role-based sidebar navigation (Artist/Client/Admin)
- Single-page application with client-side routing
- Session-based auth with login page
- Protected routes redirect unauthenticated users
- Shared server state via React Query + UI state via Zustand
- shadcn/ui component library with Tailwind CSS

## Decision

### 1. Route Architecture

Use `createBrowserRouter` from React Router v6 (data router) for:

- Declarative nested route hierarchy
- `Outlet` for the app shell layout
- Protected route wrapper at the top of the authenticated tree

The router is defined in `src/router.tsx` and imported by `App.tsx`.

### 2. Component Hierarchy

```
RouterProvider
 ├── /login → LoginPage (standalone, no shell)
 └── / (ProtectedRoute)
      └── AppShell
           ├── Sidebar
           ├── TopBar
           └── Outlet → page content
```

- `ProtectedRoute` checks `GET /api/auth/me` via React Query, shows loading spinner during check, redirects to `/login` on failure.
- `AppShell` renders the sidebar + topbar + main content area.
- `Sidebar` renders navigation items from `src/lib/navigation.ts` based on user role.
- `TopBar` shows workspace badge, notification bell, and user avatar dropdown.

### 3. State Management

- **Server state**: TanStack React Query v5 with query keys following the project convention (`['actors']`, `['actors', id]`, `['auth', 'me']`, etc.)
- **UI state**: Zustand store for sidebar collapsed state, active modal, toast queue
- **URL state**: All filters and pagination synced to URL search params (future)
- No global state for server data — it all lives in React Query

### 4. API Client

Axios instance with:

- `baseURL: '/api'` (proxied by Vite to `localhost:3001`)
- `withCredentials: true` for session cookies
- Error interceptor that standardizes error shape to `{ code, message, details? }`

### 5. Auth Flow

- `useCurrentUser()` query fetches `GET /api/auth/me` on mount
- `useLogin()` mutation posts credentials, sets query cache on success
- `useLogout()` mutation clears session and invalidates all queries
- No auth context needed — the session check is just a React Query hook

### 6. shadcn/ui Integration

- Initialized with `@base-ui/react` primitives (the default for shadcn v4)
- Tailwind v3 with CSS variables for theming
- Installed components: Button, Card, Input, Avatar, Badge, Separator, DropdownMenu, Tooltip, ScrollArea, Label, Alert, Dialog

### 7. Navigation Config

Sidebar items are defined in `src/lib/navigation.ts` as a `getNavItems(role)` function that returns role-appropriate nav trees. Three role profiles:

- **Artist**: Dashboard, Tools, Library, Marketplace (manage), Commissions, Settings (profile + API keys)
- **Client**: Dashboard, Tools, Library, Marketplace, Commissions, Settings (profile + wallet)
- **Admin**: Dashboard, Tools, Library, Marketplace (store + submissions + listings), Commissions, Settings (users, models, prompts, taxonomy, commission forms)

### 8. Code Quality

- Every component file is under 200 lines (per AGENTS.md rule)
- Navigation config extracted to separate file to keep Sidebar.tsx under limit
- `cn()` utility from shadcn for conditional class merging

## Alternatives Considered

### React Context for auth state

Rejected: React Query already handles loading/error/success states and cache invalidation. Adding context would duplicate this. The session check is just another query.

### Redux for UI state

Rejected: Overkill for sidebar toggle, modals, and toasts. Zustand is minimal (0.5KB), has no boilerplate, and TypeScript inference works out of the box.

### File-based routing (Next.js / TanStack Router)

Rejected: The project uses Vite + React Router v6, not Next.js. TanStack Router would add an unnecessary new dependency when React Router v6 works well.

## Consequences

- All authenticated pages automatically get loading, error, and redirect behavior from ProtectedRoute
- Adding a new page is: create the component → add a route to router.tsx (or add a nav item to navigation.ts)
- Role changes don't require frontend deploys — the sidebar reads the role from the server response
- The build output is ~547KB JS + 44KB CSS (with some chunk-size optimization needed later)
- Future tasks (T23 onward) can focus on page content without worrying about shell/routing
