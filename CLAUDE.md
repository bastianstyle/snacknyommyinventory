# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install        # install dependencies (package-lock.json and pnpm-lock.yaml both exist; check which one the user actually uses before switching package managers)
npm run dev         # start Vite dev server on port 8080 (see vite.config.ts)
npm run build        # production build -> dist/
npm run build:dev      # development-mode build
npm run preview       # preview a production build locally
npm run lint         # ESLint (flat config in eslint.config.js)
```

There is no test suite/runner configured in this repo.

Firebase config (`src/lib/firebase.ts`) is currently hardcoded inline rather than read from `.env.local`, despite the README describing a `VITE_FIREBASE_*` env var setup — be aware of this mismatch when touching Firebase init.

## Architecture

This is a client-only React + TypeScript SPA (Vite) that manages multi-branch snack inventory, backed directly by **Firebase** (Authentication + Firestore, no backend server). All data access happens straight from React components/contexts via the Firestore SDK — there is no API layer.

### Routing & access control
- Routes live in `src/App.tsx` (per `AI_RULES.md`, keep them there). Provider nesting: `QueryClientProvider` > `TooltipProvider` > `AuthProvider` > `BrowserRouter` > `DataProvider` > `Routes`.
- `ProtectedRoute` (`src/components/ProtectedRoute.tsx`) gates routes on `useAuth()`: redirects to `/login` if unauthenticated, and to `/` if the route has `requiredRole="admin"` but the user's role doesn't match. `/branches` and `/users` are admin-only; everything else is available to any authenticated role.
- Two roles exist: `admin` (full access) and `manager` (scoped to their own branch via `userBranchId`). Role/branch enforcement is duplicated in two places that must stay in sync: `ProtectedRoute`/UI conditionals on the client, and `firestore.rules` on the server (the real security boundary — never rely on client checks alone).

### Auth & global data (contexts)
- `AuthContext` (`src/contexts/AuthContext.tsx`) subscribes to `onAuthStateChanged`, then fetches the matching `users/{uid}` Firestore doc to derive `role` and `userBranchId`. It blocks rendering behind a full-screen skeleton until the initial auth check resolves.
- `DataContext` (`src/contexts/DataContext.tsx`) opens real-time `onSnapshot` listeners on the `branches` and `items` collections (only once a user is authenticated) and exposes them plus derived `branchesMap`/`itemsMap` lookups. Most pages read master data (branch names, item metadata) through this context rather than querying Firestore directly.
- `ThemeContext` (`src/contexts/ThemeContext.tsx`) + `ThemeToggle` component handle light/dark mode (in progress, not yet wired everywhere).

### Firestore collections
- `users/{uid}` — `role` (`admin`|`manager`), `branchId`
- `branches/{id}` — branch master data
- `items/{id}` — item master data (SKU, category, unit)
- `inventory/{id}` — per-branch stock documents (`InventoryDoc`/`InventoryEntry` in `src/pages/Inventory.tsx`)
- `transfers/{id}` — inter-branch transfer requests (`Transfer` in `src/pages/Transfers.tsx`), with `status`: `pending` → `approved` → `shipped` → `completed`, or `rejected`; each transition is a separate `updateDoc` call gated by role/branch ownership
- `incoming_items/{id}` — stock-in records (`IncomingItem` in `src/pages/IncomingItems.tsx`)
- `outgoing_items` — stock-out records, mirrors `incoming_items`

Security rules (`firestore.rules`) define helper predicates `isAdmin()`, `isManager()`, `isManagerOfBranch(branchId)` used across collection rules — when adding a new collection or changing access patterns, update both the Firestore rules and the client-side role checks together.

### UI conventions
- Pages live in `src/pages/`, components in `src/components/`, generated shadcn/ui primitives in `src/components/ui/` — per `AI_RULES.md`, treat `ui/` files as vendored/do-not-edit; wrap or extend instead.
- Forms follow a consistent `Add*Form`/`Edit*Form`/`New*Form` naming pattern (e.g. `AddItemForm`, `EditItemForm`, `NewTransferForm`) and use `react-hook-form` + `zod` resolvers with shadcn `Form` components.
- Use the `@/` path alias (maps to `src/`) for imports.
- Styling is Tailwind CSS utility classes plus shadcn/ui (Radix) components; prefer composing existing shadcn primitives over hand-rolled UI.
