FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files (including lockfile) and install full deps for build
COPY package*.json ./
COPY package-lock.json ./
RUN npm ci --legacy-peer-deps --no-audit --no-fund

# Copy tsconfig and source, then build
COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY src/ ./src/
RUN npm run build

# Remove devDependencies to keep only production deps
RUN npm prune --production --legacy-peer-deps

FROM node:22-alpine AS production

LABEL maintainer="Whisper Team" \
    service="Scheduling-service" \
    version="1.0.0" \
    environment="production" \
    org.opencontainers.image.source="https://github.com/whisper/scheduling-service" \
    org.opencontainers.image.description="Whisper Scheduling Service" \
    org.opencontainers.image.licenses="MIT"

WORKDIR /app

# Copy built application and production deps from builder
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/package*.json ./

USER node

ENV NODE_ENV=production

EXPOSE 3001 50051

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node dist/docker/health-check.js || exit 1

CMD ["node", "dist/docker/entrypoint.js"]

