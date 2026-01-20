# Gygax

Old-school D&D virtual tabletop.

**Key docs:**
- `/prd.md` — Full requirements, features, design specifications
- `/specs/` — Implementation specs (build in order)

## Stack

- **Frontend:** React, Vite, Tailwind, Neobrutalism components
- **Backend:** Node.js, Fastify, WebSockets, WebRTC
- **Database:** PostgreSQL, Prisma ORM
- **Language:** TypeScript (full-stack)
- **Monorepo:** npm workspaces

## Pinned Versions

**Do not upgrade these without explicit approval:**

| Dependency | Version |
|------------|---------|
| Node.js | 24.13.0 |
| React | 19.2.3 |
| React Router | 7.12.0 |
| Fastify | 5.7.1 |
| Prisma | 7.2.0 |
| PostgreSQL | 18.1 |

## Project Structure

```
/client              # React SPA (Vite)
  /src
    /components      # UI components
    /pages           # Page components
    /hooks           # Custom hooks
    /stores          # State management
    /utils           # Helpers
/server              # Fastify API + WebSocket server
  /src
    /routes          # REST endpoints
    /plugins         # Fastify plugins
    /services        # Business logic
    /websocket       # Real-time handlers
    /utils           # Server utilities
/shared              # Shared types and constants
/prisma              # Database schema
/docker              # Docker configurations
/specs               # Implementation specs
```

## Commands

```bash
# Development (Docker Compose - full stack with hot reload)
npm run dev              # Start all containers (db, server, client)
npm run dev:build        # Rebuild and start containers
npm run dev:down         # Stop all containers
npm run dev:logs         # Tail logs from all services
npm run dev:logs:client  # Tail client logs only
npm run dev:logs:server  # Tail server logs only

# Database (run locally, requires DATABASE_URL)
npm run db:generate      # Generate Prisma client
npm run db:migrate       # Create and apply migrations
npm run db:migrate:deploy # Apply migrations (CI/production)
npm run db:migrate:reset # Drop DB and re-run all migrations
npm run db:studio        # Open Prisma Studio

# Quality
npm run lint             # Lint check
npm run typecheck        # TypeScript check
npm test                 # Run tests

# Build
npm run build            # Production build
```

## Conventions

### Code Style
- Functional components with hooks (no class components)
- Named exports preferred
- Colocate tests with source files (`*.test.ts`)

### Naming
- Components: `PascalCase.tsx`
- Hooks: `useCamelCase.ts`
- Utils: `camelCase.ts`
- Types: `PascalCase` (no `I` prefix for interfaces)

### State Management
- Local state for component-specific data
- Stores for shared/global state
- WebSocket for real-time sync

### Testing
- Unit tests for utils, hooks, services
- Integration tests for API routes
- E2E tests for critical user flows

## Specs

Implementation specs in `/specs/` — build in order:

| Spec | Description | Status |
|------|-------------|--------|
| 001-foundation | Project setup, Docker, health check | Pending |
| 002-auth | Authentication system | Planned |
| 003-campaigns | Campaign CRUD | Planned |
| 004-map-editor | Map drawing tools | Planned |

## Current Focus

<!-- Update as work progresses -->
- [ ] Implement spec 001-foundation
