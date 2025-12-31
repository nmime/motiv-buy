# =============================================================================
# Multi-Stage Dockerfile for NestJS Monorepo
# Optimized to build ALL apps in one Nx command to prevent duplicate lib builds
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Dependencies (cached, shared by all apps)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS deps
RUN npm install -g pnpm@10.22.0
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Stage 2: Build ALL Applications (Nx deduplicates shared library builds)
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

# Build ALL apps in ONE command - Nx will:
# 1. Build each shared lib ONCE
# 2. Build all apps in parallel
# 3. Reuse compiled libs across apps
# NX_DAEMON=false for Docker compatibility
RUN echo "🏗️  Building ALL apps (Nx will deduplicate shared libraries)..." && \
    NX_DAEMON=false pnpm nx run-many -t build --projects=api,bot,migration --parallel=3 && \
    echo "✅ All apps built successfully"

# Verify all build outputs exist
RUN test -f dist/apps/api/src/main.js || (echo "ERROR: API build failed" && exit 1) && \
    test -f dist/apps/bot/src/main.js || (echo "ERROR: Bot build failed" && exit 1) && \
    test -f dist/apps/migration/src/main.js || (echo "ERROR: Migration build failed" && exit 1)

# -----------------------------------------------------------------------------
# Stage 3: Production Runtime (one per app)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS production
ARG APP_NAME
RUN test -n "$APP_NAME" || (echo "ERROR: APP_NAME build arg required" && exit 1)

# Persist APP_NAME as ENV for runtime (ARG only available during build)
ENV APP_NAME=${APP_NAME}

RUN npm install -g pnpm@10.22.0

# Security: non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
WORKDIR /app

# Copy workspace configs (needed by Nx at runtime)
COPY --chown=nodejs:nodejs package.json pnpm-workspace.yaml nx.json tsconfig.json ./

# Copy ALL dependencies (includes production + dev) and built apps
# Note: Using full node_modules from deps stage to ensure all dependencies are available
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=all-apps-builder --chown=nodejs:nodejs /app/dist ./dist

# Copy i18n locales (needed at runtime by the i18n module)
COPY --chown=nodejs:nodejs libs/common/intl/locales ./libs/common/intl/locales

# Final verification for this specific app
RUN test -f dist/apps/${APP_NAME}/src/main.js || \
    (echo "ERROR: Production image missing entrypoint for ${APP_NAME}" && exit 1)

USER nodejs
EXPOSE 3000

CMD ["sh", "-c", "node dist/apps/${APP_NAME}/src/main.js"]
