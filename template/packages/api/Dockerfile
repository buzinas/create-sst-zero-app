FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.24.0 --activate

FROM base AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/api/package.json packages/api/
COPY packages/core/package.json packages/core/
RUN pnpm install --frozen-lockfile
COPY packages/api packages/api
COPY packages/core packages/core

FROM base
WORKDIR /app
COPY --from=build /app /app
EXPOSE 3001
ENV PORT=3001
CMD ["pnpm", "--filter", "@app/api", "run", "dev"]
