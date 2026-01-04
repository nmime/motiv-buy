# syntax=docker/dockerfile:1.4
# =============================================================================
# Multi-Stage Dockerfile for NestJS Monorepo
# Optimized with BuildKit cache mounts for fast rebuilds
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Dependencies (cached with BuildKit mount)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS deps
RUN npm install -g pnpm@10.22.0
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Stage 2: Production Dependencies Only (smaller image)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS deps-prod
RUN npm install -g pnpm@10.22.0
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod

# -----------------------------------------------------------------------------
# Stage 3: Build ALL Applications (Nx deduplicates shared library builds)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS all-apps-builder
RUN npm install -g pnpm@10.22.0
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy all source files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml nx.json tsconfig.json ./
COPY apps ./apps
COPY libs ./libs
COPY packages ./packages

# Build ALL apps in ONE command with NX cache mount
# Nx will: 1) Build each shared lib ONCE  2) Build all apps in parallel
RUN --mount=type=cache,id=nx-cache,target=/app/.nx/cache \
    echo "Building ALL apps (Nx will deduplicate shared libraries)..." && \
    NX_DAEMON=false pnpm nx run-many -t build --projects=api,bot,migration --parallel=3 && \
    echo "All apps built successfully"

# Verify all build outputs exist
RUN test -f dist/apps/api/src/main.js || (echo "ERROR: API build failed" && exit 1) && \
    test -f dist/apps/bot/src/main.js || (echo "ERROR: Bot build failed" && exit 1) && \
    test -f dist/apps/migration/src/main.js || (echo "ERROR: Migration build failed" && exit 1)

# -----------------------------------------------------------------------------
# Stage 4: Production Runtime (one per app)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS production
ARG APP_NAME
RUN test -n "$APP_NAME" || (echo "ERROR: APP_NAME build arg required" && exit 1)

# Persist APP_NAME as ENV for runtime
ENV APP_NAME=${APP_NAME}

# Install wget for health checks and create non-root user
RUN apk add --no-cache wget && \
    addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
WORKDIR /app

# Copy workspace configs (needed by some runtime imports)
COPY --chown=nodejs:nodejs package.json pnpm-workspace.yaml nx.json tsconfig.json ./

# Copy PRODUCTION dependencies only (smaller image)
COPY --from=deps-prod --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy built apps
COPY --from=all-apps-builder --chown=nodejs:nodejs /app/dist ./dist

# Copy i18n locales (needed at runtime)
COPY --chown=nodejs:nodejs libs/common/intl/locales ./libs/common/intl/locales

# Final verification
RUN test -f dist/apps/${APP_NAME}/src/main.js || \
    (echo "ERROR: Production image missing entrypoint for ${APP_NAME}" && exit 1)

USER nodejs
EXPOSE 3000

CMD ["sh", "-c", "node dist/apps/${APP_NAME}/src/main.js"]
