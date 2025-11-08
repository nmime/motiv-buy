# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:20-alpine AS deps

# Install pnpm
RUN npm install -g pnpm@8

WORKDIR /app

# Copy all package.json files for dependency installation
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/**/package.json ./apps/
COPY libs/**/package.json ./libs/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# ============================================
# Stage 2: Builder
# ============================================
FROM node:20-alpine AS builder

# Build argument to specify which app to build
ARG APP_NAME
RUN test -n "$APP_NAME" || (echo "APP_NAME build argument is required" && false)

# Install pnpm
RUN npm install -g pnpm@8

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/pnpm-lock.yaml ./

# Copy all source code
COPY . .

# Build the specified application
RUN pnpm run build ${APP_NAME}

# ============================================
# Stage 3: Production
# ============================================
FROM node:20-alpine AS production

# Build argument to specify which app to run
ARG APP_NAME
RUN test -n "$APP_NAME" || (echo "APP_NAME build argument is required" && false)

# Install pnpm
RUN npm install -g pnpm@8

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/**/package.json ./apps/
COPY libs/**/package.json ./libs/

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy built application and config from builder
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/tsconfig.json ./
COPY --from=builder --chown=nodejs:nodejs /app/nest-cli.json ./
COPY --from=builder --chown=nodejs:nodejs /app/apps/${APP_NAME}/tsconfig.json ./apps/${APP_NAME}/

# Switch to non-root user
USER nodejs

# Expose port (will be overridden by docker-compose if needed)
EXPOSE 3000

# Set the command based on the app
CMD node dist/apps/${APP_NAME}/main.js
