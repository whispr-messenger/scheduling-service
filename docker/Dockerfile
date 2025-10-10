# ================================
# Build stage
# ================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for building)
RUN npm ci && \
    npm cache clean --force

# Copy application source
COPY . .

# Build TypeScript application
RUN npm run build

# ================================
# Production stage
# ================================
FROM node:20-alpine

# Install curl for health checks
RUN apk add --no-cache curl && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built application from builder
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist

# Copy .proto files from builder (they exist there)
COPY --from=builder /app/src/modules/grpc/proto ./dist/src/modules/grpc/proto

# Switch to non-root user
USER nestjs

# Expose application port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/v1/monitoring/health || exit 1

CMD ["node", "dist/main.js"]
