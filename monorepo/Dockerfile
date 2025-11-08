# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:20-alpine AS deps

# Install pnpm
RUN npm install -g pnpm@9

WORKDIR /app

# Copy workspace configuration and all source
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps ./apps
COPY libs ./libs
COPY packages ./packages

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
RUN npm install -g pnpm@9

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy all source code
COPY . .

# Build the specified application
RUN pnpm run build:${APP_NAME}

# ============================================
# Stage 3: Production
# ============================================
FROM node:20-alpine AS production

# Build argument to specify which app to run
ARG APP_NAME
RUN test -n "$APP_NAME" || (echo "APP_NAME build argument is required" && false)

# Install pnpm
RUN npm install -g pnpm@9

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy workspace configuration and structure
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps ./apps
COPY libs ./libs
COPY packages ./packages

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy built application from builder
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Set the command based on the app
CMD ["sh", "-c", "node dist/apps/${APP_NAME}/main.js"]
