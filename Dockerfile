# =============================================================================
# Multi-Stage Dockerfile for NestJS Monorepo
# Simplified build strategy that works with Nx dependency management
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
# Stage 2: Build Application (with all dependencies)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS app-builder
ARG APP_NAME
RUN test -n "$APP_NAME" || (echo "ERROR: APP_NAME build arg required" && exit 1)
RUN npm install -g pnpm@10.22.0
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy all source files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml nx.json tsconfig.json ./
COPY apps ./apps
COPY libs ./libs
COPY packages ./packages

# Build app with all its dependencies in one go
# Nx will handle dependency resolution and caching automatically
# NX_DAEMON=false for Docker compatibility
RUN echo "🏗️  Building ${APP_NAME} and its dependencies..." && \
    NX_DAEMON=false pnpm nx build ${APP_NAME} --verbose && \
    echo "✅ Build completed for ${APP_NAME}"

# Verify build output
RUN test -f dist/apps/${APP_NAME}/src/main.js || \
    (echo "ERROR: Build failed - dist/apps/${APP_NAME}/src/main.js not found" && exit 1)

# -----------------------------------------------------------------------------
# Stage 4: Production Dependencies (cached, shared by all apps)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS prod-deps
RUN npm install -g pnpm@10.22.0
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile

# -----------------------------------------------------------------------------
# Stage 5: Production Runtime (minimal, secure)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS production
ARG APP_NAME
RUN test -n "$APP_NAME" || (echo "ERROR: APP_NAME build arg required" && exit 1)
RUN npm install -g pnpm@10.22.0

# Security: non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
WORKDIR /app

# Copy workspace configs (needed by Nx at runtime)
COPY --chown=nodejs:nodejs package.json pnpm-workspace.yaml nx.json tsconfig.json ./

# Copy production dependencies and built app
COPY --from=prod-deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=app-builder --chown=nodejs:nodejs /app/dist ./dist

# Final verification
RUN test -f dist/apps/${APP_NAME}/src/main.js || \
    (echo "ERROR: Production image missing entrypoint" && exit 1)

USER nodejs
EXPOSE 3000

CMD ["sh", "-c", "node dist/apps/${APP_NAME}/src/main.js"]
