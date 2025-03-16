FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package.json and package-lock.json
COPY package.json package-lock.json ./

# Install dependencies (including dev dependencies for build)
RUN npm ci

# Development image for hot reloading
FROM base AS development
WORKDIR /app

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser && \
    mkdir -p /app/data && \
    chown -R appuser:nodejs /app

# No need to install TypeScript and ts-node globally as we'll use npx tsx

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY tsconfig.json ./
COPY drizzle.config.ts ./
COPY docker-entrypoint.sh ./

# Ensure node_modules has correct permissions
RUN chmod -R 777 /app/node_modules

# Make entrypoint script executable
RUN chmod +x ./docker-entrypoint.sh

# Switch to non-root user
USER appuser

# Expose the port the app runs on
EXPOSE 5000

# Set entrypoint
ENTRYPOINT ["./docker-entrypoint.sh"]

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application
RUN npm run build

# Production image, copy all the files and run the app
FROM base AS production
WORKDIR /app

ENV NODE_ENV=production

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser && \
    mkdir -p /app/data && \
    chown -R appuser:nodejs /app

# Copy necessary files from builder
COPY --from=builder --chown=appuser:nodejs /app/dist ./dist
COPY --from=builder --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:nodejs /app/package.json ./package.json
COPY --from=builder --chown=appuser:nodejs /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder --chown=appuser:nodejs /app/shared ./shared
COPY --from=builder --chown=appuser:nodejs /app/docker-entrypoint.sh ./docker-entrypoint.sh

# Make entrypoint script executable
RUN chmod +x ./docker-entrypoint.sh

# Switch to non-root user
USER appuser

# Expose the port the app runs on
EXPOSE 5000

# Set entrypoint
ENTRYPOINT ["./docker-entrypoint.sh"]
