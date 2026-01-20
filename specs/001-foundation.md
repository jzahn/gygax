# Spec 001: Foundation

## Goal

Establish the project scaffolding, development environment, and verify end-to-end stack connectivity with a health check that touches all layers (UI → API → Prisma → Database).

## Scope

### In Scope

- Monorepo structure (client, server, shared)
- Full-stack Docker Compose orchestration (PostgreSQL, Server, Client)
- Hot reloading for both frontend and backend in containers
- React + Vite + TypeScript client scaffold
- Fastify + TypeScript server scaffold
- Prisma ORM setup with PostgreSQL connection
- Health check API endpoint
- Health check UI page
- Development scripts and tooling
- Basic ESLint + Prettier configuration

### Out of Scope

- Authentication (see spec 002)
- Neobrutalism UI components (styling comes later)
- WebSocket setup
- WebRTC/audio
- Any business logic beyond health check
- Production deployment configuration
- CI/CD pipeline

## Dependencies

- Node.js 24.13.0
- Docker & Docker Compose
- npm (included with Node.js)

**Pinned Versions (see CLAUDE.md):**
| Dependency | Version |
|------------|---------|
| Node.js | 24.13.0 |
| React | 19.2.3 |
| React Router | 7.12.0 |
| Fastify | 5.7.1 |
| Prisma | 7.2.0 |
| PostgreSQL | 18.1 |

**Port Requirements:**
Ensure these ports are available before starting:

- `5432` — PostgreSQL
- `3000` — Server API
- `5173` — Client (Vite)

## Detailed Requirements

### 1. Project Structure

```
/gygax
  /.claude
    CLAUDE.md
  /client                    # React frontend
    /src
      /components
        HealthCheck.tsx      # Health check UI component
      /pages
        index.tsx            # Home page (shows health check)
      App.tsx
      main.tsx
    index.html
    package.json
    tsconfig.json
    vite.config.ts
  /server                    # Fastify backend
    /src
      /routes
        health.ts            # Health check route
      /plugins
        prisma.ts            # Prisma plugin
      app.ts                 # Fastify app setup
      server.ts              # Entry point
    package.json
    tsconfig.json
  /shared                    # Shared types
    /src
      types.ts               # Common TypeScript types
    package.json
    tsconfig.json
  /prisma
    /migrations
      /20240119000000_healthcheck
        migration.sql        # Initial migration
      migration_lock.toml
    schema.prisma            # Database schema
  /docker
    Dockerfile.client        # Client container
    Dockerfile.server        # Server container
    entrypoint.server.sh     # Server startup script (runs migrations)
  docker-compose.yml         # Full stack orchestration (root level)
  package.json               # Root package.json (workspaces config)
  package-lock.json          # Lockfile
  tsconfig.base.json         # Shared TypeScript config
  .env.example               # Environment template
  .dockerignore              # Docker build exclusions
  .gitignore                 # Git exclusions
  .prettierrc                # Prettier configuration
  eslint.config.js           # ESLint flat config
  prd.md
  /specs
    001-foundation.md
```

### 2. Docker Configuration

**Project Structure:**

```
/docker
  Dockerfile.client        # Client container
  Dockerfile.server        # Server container
  entrypoint.server.sh     # Server startup (migrations + dev server)
docker-compose.yml         # Root level for easy `docker compose up`
.dockerignore              # Exclude from build context
```

**docker-compose.yml (full stack with hot reload):**

```yaml
services:
  db:
    image: postgres:18.1-alpine
    environment:
      POSTGRES_USER: gygax
      POSTGRES_PASSWORD: gygax
      POSTGRES_DB: gygax
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - '5432:5432'
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U gygax']
      interval: 5s
      timeout: 5s
      retries: 5

  server:
    build:
      context: .
      dockerfile: docker/Dockerfile.server
    environment:
      DATABASE_URL: postgresql://gygax:gygax@db:5432/gygax?schema=public
      PORT: 3000
      CLIENT_URL: http://localhost:5173
    ports:
      - '3000:3000'
    volumes:
      - ./server/src:/app/server/src # Hot reload source
      - ./shared/src:/app/shared/src # Shared types
      - ./prisma:/app/prisma # Schema + migrations
      - /app/node_modules # Exclude node_modules
    depends_on:
      db:
        condition: service_healthy
    # Entrypoint runs migrations + seed, then executes this command
    command: ['npm', 'run', 'dev:server']

  client:
    build:
      context: .
      dockerfile: docker/Dockerfile.client
    environment:
      VITE_API_URL: http://localhost:3000
    ports:
      - '5173:5173'
    volumes:
      - ./client/src:/app/client/src # Hot reload source
      - ./shared/src:/app/shared/src # Shared types
      - /app/node_modules # Exclude node_modules
    depends_on:
      - server
    command: ['npm', 'run', 'dev:client']

volumes:
  postgres_data:
```

**docker/Dockerfile.server:**

```dockerfile
FROM node:24.13.0-alpine

WORKDIR /app

# Copy workspace config and package files
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY shared/package.json ./shared/
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy source (will be overwritten by volume mount in dev)
COPY server ./server/
COPY shared ./shared/

# Copy entrypoint script
COPY docker/entrypoint.server.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Generate Prisma client
RUN npm run db:generate

EXPOSE 3000

ENTRYPOINT ["/entrypoint.sh"]
```

**docker/entrypoint.server.sh:**

```bash
#!/bin/sh
set -e

echo "Running database migrations..."
npm run db:migrate:deploy

echo "Seeding database..."
npm run db:seed

echo "Starting server..."
exec "$@"
```

This entrypoint:

1. Runs `prisma migrate deploy` on every startup (safe — skips already-applied migrations)
2. Runs the seed script (should be idempotent)
3. Executes the passed command (`pnpm dev:server`)

**docker/Dockerfile.client:**

```dockerfile
FROM node:24.13.0-alpine

WORKDIR /app

# Copy workspace config and package files
COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY shared/package.json ./shared/

# Install dependencies
RUN npm ci

# Copy source (will be overwritten by volume mount in dev)
COPY client ./client/
COPY shared ./shared/

EXPOSE 5173
```

**.dockerignore:**

```
# Dependencies
node_modules
**/node_modules

# Build outputs
dist
build
.next
.nuxt

# Git
.git
.gitignore

# Environment
.env
.env.*
!.env.example

# IDE
.idea
.vscode
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
pnpm-debug.log*

# Test coverage
coverage

# Misc
*.md
!README.md
```

**Hot Reload Configuration:**

- **Client (Vite):** Vite HMR works via WebSocket. Configure `vite.config.ts` with:

  ```typescript
  server: {
    host: '0.0.0.0',  // Listen on all interfaces (required for Docker)
    watch: {
      usePolling: true  // Required for Docker volume mounts
    }
  }
  ```

- **Server (Fastify):** Use `tsx watch` for TypeScript hot reload:
  ```json
  // server/package.json
  "scripts": {
    "dev": "tsx watch src/server.ts"
  }
  ```

### 3. Client Application

**Requirements:**

- React 19.2.3 with TypeScript
- React Router 7.12.0 for client-side routing
- Vite as build tool
- Single page with health check display
- Fetches `/api/health` on load
- Displays connection status for each layer:
  - API reachable: ✓/✗
  - Database connected: ✓/✗
  - Timestamp of last check
- Auto-refresh every 30 seconds
- Basic error handling (API unreachable state)

**No styling required** — plain HTML/default styles are acceptable for this spec. Neobrutalism styling will be applied in a future spec.

### 4. Server Application

**Requirements:**

- Fastify with TypeScript
- CORS enabled for local development
- Prisma client as Fastify plugin
- Environment variable configuration:
  - `PORT` (default: 3000)
  - `DATABASE_URL` (PostgreSQL connection string)
  - `CLIENT_URL` (for CORS, default: http://localhost:5173)

**Routes:**

`GET /api/health`

The health check verifies database connectivity by fetching the seeded `HealthCheck` row.

```json
{
  "status": "healthy" | "unhealthy",
  "timestamp": "2024-01-19T12:00:00.000Z",
  "services": {
    "api": {
      "status": "up",
      "responseTime": 1
    },
    "database": {
      "status": "up" | "down",
      "responseTime": 15,
      "error": null | "connection refused"
    }
  }
}
```

**Health check logic:**

```typescript
// Verify DB by reading the seeded row
const healthRow = await prisma.healthCheck.findUnique({
  where: { id: 'healthcheck-seed' },
})
const dbHealthy = healthRow?.status === 'ok'
```

### 5. Prisma Setup

**schema.prisma:**

- PostgreSQL provider
- Basic `HealthCheck` model (for verifying database connectivity):
  ```prisma
  model HealthCheck {
    id        String   @id @default(cuid())
    checkedAt DateTime @default(now())
    status    String   @default("ok")
  }
  ```

**Migrations:**

Initial migration `001_healthcheck` creates the `HealthCheck` table. This establishes:

- The migration workflow from day one
- A table the health check endpoint can query to verify DB connectivity

```
/prisma
  /migrations
    /20240119000000_healthcheck
      migration.sql
    migration_lock.toml
  schema.prisma
  seed.ts                    # Seed script
```

**Seed Script (prisma/seed.ts):**

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Upsert ensures idempotency — safe to run multiple times
  await prisma.healthCheck.upsert({
    where: { id: 'healthcheck-seed' },
    update: {},
    create: {
      id: 'healthcheck-seed',
      status: 'ok',
    },
  })
  console.log('Seed complete: HealthCheck row created')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

**package.json prisma config:**

```json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

**Requirements:**

- `npx prisma generate` generates the client
- `npx prisma migrate dev` applies migrations in development
- `npx prisma migrate deploy` applies migrations in production/CI
- `npx prisma db seed` runs the seed script (also runs automatically after `migrate reset`)
- Health check endpoint reads the seeded row to verify DB connectivity

### 6. Shared Package

**Requirements:**

- TypeScript types shared between client and server
- Health check response type definition
- Exported and consumable by both client and server

**shared/package.json:**

```json
{
  "name": "@gygax/shared",
  "version": "0.0.1",
  "main": "./src/index.ts",
  "types": "./src/index.ts"
}
```

**shared/src/types.ts:**

```typescript
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy'
  timestamp: string
  services: {
    api: {
      status: 'up' | 'down'
      responseTime: number
    }
    database: {
      status: 'up' | 'down'
      responseTime: number
      error: string | null
    }
  }
}
```

**Vite Configuration (client/vite.config.ts):**

For Vite to resolve the workspace package correctly:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@gygax/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
  server: {
    host: '0.0.0.0',
    watch: {
      usePolling: true,
    },
  },
})
```

**Usage in client:**

```typescript
import type { HealthCheckResponse } from '@gygax/shared'
```

**Usage in server:**

```typescript
import type { HealthCheckResponse } from '@gygax/shared'
```

### 7. Development Scripts

**Root package.json scripts:**

```json
{
  "dev": "docker compose up",
  "dev:build": "docker compose up --build",
  "dev:down": "docker compose down",
  "dev:logs": "docker compose logs -f",
  "dev:logs:client": "docker compose logs -f client",
  "dev:logs:server": "docker compose logs -f server",
  "dev:client": "npm run dev --workspace=client",
  "dev:server": "npm run dev --workspace=server",
  "build": "npm run build --workspace=client && npm run build --workspace=server",
  "lint": "eslint .",
  "lint:fix": "eslint . --fix",
  "format": "prettier --write .",
  "format:check": "prettier --check .",
  "typecheck": "tsc --noEmit",
  "db:generate": "prisma generate",
  "db:migrate": "prisma migrate dev",
  "db:migrate:create": "prisma migrate dev --create-only",
  "db:migrate:deploy": "prisma migrate deploy",
  "db:migrate:reset": "prisma migrate reset",
  "db:seed": "prisma db seed",
  "db:studio": "prisma studio"
}
```

**Root package.json workspaces config:**

```json
{
  "name": "gygax",
  "private": true,
  "workspaces": ["client", "server", "shared"]
}
```

**Note:** Most development happens via Docker Compose. The `db:*` commands are for local Prisma operations (creating migrations, etc.) and require `DATABASE_URL` to be set.

### 8. ESLint + Prettier Configuration

**ESLint (eslint.config.js):**
Using ESLint flat config (v9+):

```javascript
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['client/**/*.{ts,tsx}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/*.config.js'],
  }
)
```

**Prettier (.prettierrc):**

```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "es5",
  "tabWidth": 2,
  "printWidth": 100
}
```

**Root package.json scripts:**

```json
{
  "lint": "eslint .",
  "lint:fix": "eslint . --fix",
  "format": "prettier --write .",
  "format:check": "prettier --check ."
}
```

**Dev dependencies (root):**

- `eslint`
- `typescript-eslint`
- `eslint-plugin-react`
- `eslint-plugin-react-hooks`
- `prettier`

### 9. Environment Configuration

**.env.example:**

```
# Database
DATABASE_URL="postgresql://gygax:gygax@localhost:5432/gygax?schema=public"

# Server
PORT=3000
CLIENT_URL=http://localhost:5173

# Client
VITE_API_URL=http://localhost:3000
```

### 10. Git Configuration

**.gitignore:**

```
# Dependencies
node_modules/
**/node_modules/

# Build outputs
dist/
build/
.next/
.nuxt/

# Environment
.env
.env.local
.env.*.local

# Prisma
prisma/*.db
prisma/*.db-journal

# IDE
.idea/
.vscode/
*.swp
*.swo
*.sublime-*

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
pnpm-debug.log*

# Test coverage
coverage/

# Misc
*.tgz
.cache/
```

## Technical Approach

### Monorepo Strategy

Use npm workspaces for dependency management. Each package (client, server, shared) has its own package.json but shares common dev dependencies at the root. Workspaces are configured in the root package.json.

### TypeScript Configuration

Base tsconfig at root with strict settings. Each package extends the base and adds its own paths/settings.

### Prisma Integration

Prisma client generated into node_modules, imported by server. The prisma/ directory lives at the root since it's shared configuration.

### Development Workflow

1. `npm run dev` — Starts entire stack (PostgreSQL, Server, Client) via Docker Compose
2. Edit code locally — Changes hot reload in containers automatically
3. `npm run dev:logs` — Tail logs from all services
4. `npm run dev:down` — Stop all containers

### Migration Workflow

1. Edit `prisma/schema.prisma` locally
2. Run `npm run db:migrate` to create and apply migration
3. Migration files are volume-mounted, so server container picks up changes
4. For fresh start: `npm run db:migrate:reset` (drops DB, re-runs all migrations)

### When to Rebuild Containers

Source code changes are hot-reloaded via volume mounts, but some changes require a container rebuild:

| Change                      | Action Required                    |
| --------------------------- | ---------------------------------- |
| Edit `client/src/**`        | Auto hot-reload (no action)        |
| Edit `server/src/**`        | Auto hot-reload (no action)        |
| Edit `shared/src/**`        | Auto hot-reload (no action)        |
| Edit `package.json` (any)   | `npm run dev:build`                |
| Edit `package-lock.json`    | `npm run dev:build`                |
| Edit `Dockerfile.*`         | `npm run dev:build`                |
| Edit `docker-compose.yml`   | `npm run dev:down && npm run dev`  |
| Edit `prisma/schema.prisma` | Run migration, then restart server |
| Add new workspace package   | `npm run dev:build`                |

## Acceptance Criteria

### Setup & Infrastructure

- [ ] `git clone` + `npm install` succeeds
- [ ] `npm run dev` starts all three containers (db, server, client)
- [ ] PostgreSQL container becomes healthy
- [ ] Server container starts and connects to database
- [ ] Client container starts and serves the app

### Health Check Functionality

- [ ] Client loads at `http://localhost:5173`
- [ ] Server responds at `http://localhost:3000/api/health`
- [ ] Health check page shows API status as "up"
- [ ] Health check page shows Database status as "up"
- [ ] Health check reads the seeded `HealthCheck` row to verify DB connectivity
- [ ] Seed script runs on server startup (via entrypoint)
- [ ] Seed script is idempotent (safe to run multiple times)

### Hot Reloading

- [ ] Editing `client/src/**` triggers Vite HMR (changes appear without refresh)
- [ ] Editing `server/src/**` triggers server restart (tsx watch)
- [ ] Editing `shared/src/**` triggers reload in both client and server

### Database Migrations

- [ ] Initial `001_healthcheck` migration exists
- [ ] `npm run db:migrate` applies migrations successfully
- [ ] `npm run db:migrate:reset` drops and recreates database with migrations

### Code Quality

- [ ] `npm run typecheck` passes with no errors
- [ ] `npm run lint` passes with no errors
- [ ] `npm run format:check` passes with no errors
- [ ] Shared types are used by both client and server
- [ ] ESLint config works for both TypeScript and React files
- [ ] `.dockerignore` excludes node_modules and other large/unnecessary files
- [ ] `.gitignore` excludes node_modules, build outputs, and env files

## Verification Steps

### 1. Fresh Clone Test

```bash
git clone <repo>
cd gygax
npm install
npm run dev
```

Wait for all containers to start. Open http://localhost:5173 — should see health check page with all green.

### 2. Hot Reload Test (Client)

```bash
# With containers running, edit client/src/components/HealthCheck.tsx
# Add some visible text change
# Page should update automatically without manual refresh
```

### 3. Hot Reload Test (Server)

```bash
# With containers running, edit server/src/routes/health.ts
# Change the response (e.g., add a field)
# Refresh the page — new field should appear in response
```

### 4. Database Failure Test

```bash
docker compose stop db
```

Refresh page — Database should show "down" status, API should show "up".

### 5. Database Recovery Test

```bash
docker compose start db
```

Wait for health check. Refresh page — Database should show "up" status.

### 6. Migration Test

```bash
# Reset database and verify migrations apply cleanly
npm run db:migrate:reset
# Check that HealthCheck table exists and health check works
```

### 7. Seed Idempotency Test

```bash
# Run seed multiple times — should not error or create duplicates
npm run db:seed
npm run db:seed
npm run db:seed
# Verify only one HealthCheck row exists (via Prisma Studio or health endpoint)
```

### 8. Full Stack Restart Test

```bash
npm run dev:down
npm run dev
```

Everything should come back up with data persisted (postgres_data volume).

## References

- [PRD: Technical Specifications](/prd.md#technical-specifications)
- [PRD: Project Structure](/prd.md#project-structure)
- [Vite Documentation](https://vitejs.dev/)
- [Fastify Documentation](https://www.fastify.io/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [npm Workspaces](https://docs.npmjs.com/cli/v10/using-npm/workspaces)
