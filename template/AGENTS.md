# AGENTS.md

Guidelines for AI agents working in this repository.

## Project Overview

Full-stack monorepo with three packages:

- **`@app/core`** (`packages/core`) — Shared: Drizzle schema, Zero schema, queries, mutators. Never deployed directly.
- **`@app/web`** (`packages/web`) — React Router v7 SPA (SSR disabled). Deploys to S3+CloudFront via SST.
- **`@app/api`** (`packages/api`) — Hono API server on Node.js. Deploys to ECS Fargate via SST.

Tech stack: React v19, React Router v7, Tailwind CSS v4, Vite v8, Hono, Rocicorp Zero v0.25, Drizzle ORM, PostgreSQL 17, SST v3 (Ion), Turborepo, pnpm.

## Build / Lint / Test Commands

```sh
# Development
pnpm dev                              # Start all packages (Turborepo)
docker compose -f docker-compose.dev.yml up -d  # Postgres + zero-cache

# Build & typecheck
pnpm build                            # Build all packages
pnpm typecheck                        # Typecheck all packages
pnpm --filter @app/web typecheck      # Typecheck single package

# Linting (oxlint)
pnpm lint                             # Lint entire repo
pnpm lint:fix                         # Lint with autofix
npx oxlint packages/web/app/root.tsx  # Lint single file

# Formatting (oxfmt)
pnpm format                           # Format entire repo
pnpm format:check                     # Check formatting (CI)
npx oxfmt --write path/to/file.ts     # Format single file

# Testing (Vitest 4, workspace with 3 projects: core, api, web)
pnpm test                             # Watch mode, all projects
pnpm test:run                         # Single run, all projects (CI)
pnpm test:coverage                    # Single run with v8 coverage report
pnpm vitest run --project web         # Single project
pnpm vitest run --project api         # Single project
pnpm vitest run packages/api/src/app.test.ts   # Single file

# Database (Drizzle)
pnpm db:generate                      # Generate migrations from schema
pnpm db:migrate                       # Apply migrations
pnpm db:studio                        # Open Drizzle Studio

# Infrastructure (SST)
npx sst deploy --stage production                                        # Deploy production
npx sst deploy --stage pr-N --config sst.preview.config.ts               # Deploy preview
npx sst remove --stage pr-N --config sst.preview.config.ts               # Remove preview
npx sst secret set <Name> <value> --stage dev                            # Set SST secret
```

## Code Style

### Formatting (oxfmt)

- **No semicolons**
- **Single quotes** (not double)
- **Print width**: 80 characters
- **Trailing commas**: always
- **Arrow parens**: always — `(x) => x`, never `x => x`
- **Indent**: 2 spaces, no tabs
- **End of line**: LF

### Import Ordering (auto-sorted by oxfmt)

```ts
// 1. Type imports
import type { ZeroOptions } from '@rocicorp/zero'

// 2. Value imports (builtin + external)
import { Hono } from 'hono'

// 3. Internal imports (@app/* and ~/* aliases)
import { schema } from '@app/core/zero-schema'

// 4. Relative imports
import { zeroOptions } from './zero'

// 5. Side-effect imports
import './app.css'
```

Internal patterns: `~/` (web app alias) and `@app/` (workspace packages).

### TypeScript

- **Strict mode** in all packages
- **`verbatimModuleSyntax: true`** — always use `import type` for type-only imports
- Target: ES2022, module resolution: bundler
- No root tsconfig; each package has its own

### Naming Conventions

- **Files**: kebab-case (`zero-schema.ts`, `docker-compose.dev.yml`)
- **React components**: PascalCase functions, kebab-case filenames (`home.tsx` exports `Home`)
- **Variables/functions**: camelCase
- **Types/interfaces**: PascalCase
- **Constants**: camelCase (not SCREAMING_CASE)

### Linting (oxlint)

Categories enabled: `correctness: error`, `perf: error`.
Plugins: react, typescript, import, unicorn.
Use `// eslint-disable-next-line no-console -- <reason>` when `console.log` is intentional.

### Testing Conventions

- **Vitest 4** with workspace projects (`core`, `api`, `web`)
- Test files colocated with source: `foo.ts` → `foo.test.ts`
- Web tests use jsdom environment + `@testing-library/react`
- API tests use Hono's `app.request()` helper (no running server)
- Mock external dependencies with `vi.mock()` — e.g., `@rocicorp/zero/react`
- Import `{ describe, expect, test, vi }` from `vitest`

### React Patterns

- React 19 with React Router v7 file-based routing (`packages/web/app/routes/`)
- SPA mode (`ssr: false`) — no server-side rendering
- Tailwind CSS v4 utility classes
- Zero Provider wraps the app in `root.tsx`; use `useQuery`/`useZero`/`useConnectionState` from `@rocicorp/zero/react`

### Package Imports

`@app/core` uses subpath exports:

```ts
import { schema } from '@app/core/zero-schema'
import { APP_NAME } from '@app/core/index'
```

The web package uses `~/` alias:

```ts
import { zeroOptions } from '~/zero'
```

## Architecture

### Local Development

```
Browser (http://localhost:3000)
  |
  +-- /api/* proxy --> API server (localhost:3001)
  |
  +-- WS --> zero-cache (localhost:4848)
                --> Postgres (Docker, port 5432)
```

### Deployed (AWS)

```
app.example.com --> Router (CloudFront)
                       +-- /api/* --> ALB --> ECS Fargate (API)
                       +-- /*     --> S3 (React SPA)

zero.example.com --> ALB --> ECS Fargate (zero-cache)
                                --> RDS Postgres
```

### Zero Data Flow

The browser never talks to the API directly. Zero-cache handles sync:

```
Browser <--WebSocket--> zero-cache <--Postgres replication--> Postgres
                            +--HTTP POST--> API (/api/zero/query)
                            +--HTTP POST--> API (/api/zero/mutate)
```

## File Structure

```
project/
  .github/workflows/       # CI/CD pipeline (ci.yml)
  infra/                   # SST infrastructure helpers (db-manager.ts)
  scripts/                 # CI scripts (patch-sst.sh)
  vitest.config.ts         # Vitest workspace config (3 projects)
  packages/
    core/
      src/
        schema/            # Drizzle schema (Postgres tables)
        zero-schema.ts     # Zero schema (from Drizzle via drizzle-zero)
        queries.ts         # Zero query definitions
        mutators.ts        # Zero mutator definitions
        index.ts           # Shared constants/utilities
      drizzle/             # Generated migrations
    web/
      app/
        routes/            # React Router file-based routes
        root.tsx           # App shell + ZeroProvider
        zero.ts            # Zero client configuration
        app.css            # Tailwind entry point
      vitest.setup.ts      # jest-dom matchers for web tests
    api/
      src/
        app.ts             # Hono app (routes, exported for testing)
        index.ts           # Server entrypoint (imports app, calls serve)
      Dockerfile
  sst.config.ts            # SST production infra
  sst.preview.config.ts    # SST preview infra (shares dev VPC + RDS)
  sst.dev.config.ts        # SST dev shared infra (VPC, RDS, certs, DbManager)
  docker-compose.dev.yml   # Postgres + zero-cache
  turbo.json
```
