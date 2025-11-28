# =============================================================================
# Whispr Scheduling Service - Dockerfile
# Multi-stage build for production-ready NestJS application
# =============================================================================

# -----------------------------------------------------------------------------
# STAGE 1: Dependencies
# -----------------------------------------------------------------------------
FROM node:20-alpine AS dependencies

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Generate Prisma client for production
RUN npx prisma generate

# -----------------------------------------------------------------------------
# STAGE 2: Build
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY prisma ./prisma/

# Install all dependencies (including dev)
RUN npm ci

# Copy source code
COPY src ./src

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# -----------------------------------------------------------------------------
# STAGE 3: Production
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runtime

# Install curl for healthcheck
RUN apk add --no-cache curl

# Create non-root user for security
RUN addgroup -g 1000 whispr && \
    adduser -u 1000 -G whispr -s /bin/sh -D whispr

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    GRPC_PORT=3001

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=builder --chown=whispr:whispr /app/dist ./dist
COPY --from=builder --chown=whispr:whispr /app/node_modules ./node_modules
COPY --from=dependencies --chown=whispr:whispr /app/node_modules/.prisma ./node_modules/.prisma
COPY --chown=whispr:whispr package*.json ./
COPY --chown=whispr:whispr prisma ./prisma/

# Switch to non-root user
USER whispr

# Expose ports (HTTP + gRPC)
EXPOSE 3000 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3000/api/v1/monitoring/health || exit 1

# OCI Labels
LABEL org.opencontainers.image.title="Whispr Scheduling Service" \
      org.opencontainers.image.description="Job scheduling and orchestration service for Whispr Messenger" \
      org.opencontainers.image.vendor="Whispr" \
      org.opencontainers.image.version="1.0.0"

# Start the application
CMD ["node", "dist/main.js"]