# Zero App

Full-stack monorepo with React, Rocicorp Zero, Hono, and SST.

## Tech Stack

- [React 19](https://react.dev/) + [React Router 7](https://reactrouter.com/) (SPA mode)
- [Rocicorp Zero](https://zero.rocicorp.dev/) — client-side sync engine
- [Hono](https://hono.dev/) — API server
- [Drizzle ORM](https://orm.drizzle.team/) + PostgreSQL 17
- [Tailwind CSS v4](https://tailwindcss.com/)
- [SST v3](https://sst.dev/) — AWS infrastructure and deployment
- [Turborepo](https://turbo.build/) + [pnpm](https://pnpm.io/) workspaces

## Packages

| Package     | Path            | Description                                            |
| ----------- | --------------- | ------------------------------------------------------ |
| `@app/core` | `packages/core` | Shared: Drizzle schema, Zero schema, queries, mutators |
| `@app/web`  | `packages/web`  | React Router v7 SPA → S3 + CloudFront                  |
| `@app/api`  | `packages/api`  | Hono API server → ECS Fargate                          |

## Prerequisites

- [Node.js 22](https://nodejs.org/) (see `.nvmrc`)
- [pnpm 10.24.0](https://pnpm.io/) — `corepack enable` to auto-install
- [Docker](https://www.docker.com/) — for local Postgres and zero-cache

## Getting Started

### 1. Install dependencies

```sh
corepack enable
pnpm i
```

### 2. Set up environment variables

Create a `.env` file in the project root:

```sh
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_DEFAULT_ACCOUNT_ID=...
ZERO_ADMIN_PASSWORD=...
POSTGRES_PASSWORD=...
AWS_PROFILE=...
```

### 3. Start the database and zero-cache

```sh
docker compose -f docker-compose.dev.yml up -d
```

This starts:

- **Postgres 17** on port 5432
- **zero-cache** on port 4848

### 4. Run database migrations

```sh
pnpm db:migrate
```

### 5. Start dev servers

```sh
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

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

The browser never talks to the API directly. Zero handles all data sync:

```
Browser <--WebSocket--> zero-cache <--Postgres replication--> Postgres
                            +--HTTP POST--> API (/api/zero/query)
                            +--HTTP POST--> API (/api/zero/mutate)
```

## Scripts

| Command              | Description                    |
| -------------------- | ------------------------------ |
| `pnpm dev`           | Start all packages in dev mode |
| `pnpm build`         | Build all packages             |
| `pnpm typecheck`     | Typecheck all packages         |
| `pnpm lint`          | Lint with oxlint               |
| `pnpm format`        | Format with oxfmt              |
| `pnpm test`          | Run tests in watch mode        |
| `pnpm test:run`      | Run tests once (CI)            |
| `pnpm test:coverage` | Run tests with coverage        |
| `pnpm db:generate`   | Generate Drizzle migrations    |
| `pnpm db:migrate`    | Apply database migrations      |
| `pnpm db:studio`     | Open Drizzle Studio            |

## CI/CD

The project uses GitHub Actions (`.github/workflows/ci.yml`):

- **Every push/PR**: lint, typecheck, format check, build, test
- **Merge to main**: automatic production deploy
- **Pull requests**: preview environment with its own database
- **PR close/merge**: automatic cleanup of preview infrastructure and database

Preview environments share a VPC and RDS instance from the dev stage. Each PR gets its own ECS services, ALBs, CloudFront distribution, and isolated database.

## Deployment Setup

### 1. Deploy shared dev infrastructure

```sh
npx sst deploy --stage dev --config sst.dev.config.ts
```

This creates the VPC, RDS, wildcard ACM certs, and DbManager Lambda. Copy the output resource IDs into:

- `sst.config.ts` — cert ARNs
- `sst.preview.config.ts` — VPC ID, RDS ID, cert ARNs
- `.github/workflows/ci.yml` — DbManager function name

### 2. Set GitHub secrets

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_DEFAULT_ACCOUNT_ID`
- `POSTGRES_PASSWORD`
- `ZERO_ADMIN_PASSWORD`

### 3. Deploy production

Push to `main` to trigger automatic production deployment, or manually:

```sh
npx sst deploy --stage production
```

## Contributing

See [AGENTS.md](./AGENTS.md) for code style, naming conventions, testing patterns, and AI agent guidelines.
