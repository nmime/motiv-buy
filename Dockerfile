# ============================================
# Stage 1: Dependencies (Shared by all apps)
# ============================================
FROM node:20-alpine AS deps

# Install pnpm
RUN npm install -g pnpm@9

WORKDIR /app

# Copy workspace configuration (monorepo uses single package.json)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install all dependencies (this stage is cached and reused by all app builds)
RUN pnpm install --frozen-lockfile

# ============================================
# Stage 2: Libs Builder (Build shared libs ONCE)
# ============================================
FROM node:20-alpine AS libs-builder

# Install pnpm
RUN npm install -g pnpm@9

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy all workspace configs
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY nx.json tsconfig.base.json ./

# Copy all source code for libs and packages
COPY libs ./libs
COPY packages ./packages

# Build all shared libraries (this stage is cached and reused by all app builds)
RUN pnpm run build:libs

# ============================================
# Stage 3: App Builder (Build specific app)
# ============================================
FROM node:20-alpine AS app-builder

# Build argument to specify which app to build
ARG APP_NAME
RUN test -n "$APP_NAME" || (echo "APP_NAME build argument is required" && false)

# Install pnpm
RUN npm install -g pnpm@9

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy workspace configs
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY nx.json tsconfig.base.json ./

# Copy all source code
COPY apps ./apps
COPY libs ./libs
COPY packages ./packages

# Copy pre-built libs from libs-builder stage (Nx will skip rebuilding these)
COPY --from=libs-builder /app/dist/libs ./dist/libs
COPY --from=libs-builder /app/dist/packages ./dist/packages

# Build only the specified application (libs are already built, so Nx skips them)
RUN pnpm run build:${APP_NAME}

# ============================================
# Stage 4: Production Dependencies
# ============================================
FROM node:20-alpine AS prod-deps

# Install pnpm
RUN npm install -g pnpm@9

WORKDIR /app

# Copy workspace configuration (monorepo uses single package.json)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install production dependencies only (cached and shared by all apps)
RUN pnpm install --prod --frozen-lockfile

# ============================================
# Stage 5: Production Runtime
# ============================================
FROM node:20-alpine AS production

# Build argument to specify which app to run
ARG APP_NAME
RUN test -n "$APP_NAME" || (echo "APP_NAME build argument is required" && false)

# Install pnpm (needed for running the app)
RUN npm install -g pnpm@9

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy workspace configuration (minimal)
COPY --chown=nodejs:nodejs package.json pnpm-workspace.yaml ./

# Copy production dependencies from prod-deps stage
COPY --from=prod-deps --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy built application from app-builder
COPY --from=app-builder --chown=nodejs:nodejs /app/dist ./dist

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Set the command based on the app
CMD ["sh", "-c", "node dist/apps/${APP_NAME}/main.js"]
