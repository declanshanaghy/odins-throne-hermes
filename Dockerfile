# --------------------------------------------------------------------------
# Odin's Throne — Multi-stage Dockerfile
#
# Hono server (server/ -> dist-server/index.mjs) + React web bundle
# (src/ui core + src/targets/web -> dist-ui/). The server serves the web
# bundle as static assets and the API/WebSocket on :3001.
#
# Build context: repository root
# Usage: docker build -t odin-throne .
# --------------------------------------------------------------------------

# ── Stage 1: Builder ──────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first so Docker can cache them
COPY package.json package-lock.json ./
RUN npm ci

# Copy build scripts, TypeScript config, UI core + web target, and the server
COPY tsconfig.json ./
COPY build/ ./build/
COPY src/ ./src/
COPY server/ ./server/

# Build the web bundle (tsc --noEmit type-check + vite build -> dist-ui/)
RUN npm run build:web

# Bundle the Hono server (esbuild -> dist-server/index.mjs)
RUN npm run build:server

# Prune dev dependencies — the runtime image ships prod deps only
RUN npm prune --production

# ── Stage 2: Runtime ──────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

ENV NODE_ENV=production \
    PORT=3001

WORKDIR /app

# Copy only production artifacts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist-ui ./dist-ui
COPY --from=builder /app/dist-server ./dist-server
COPY --from=builder /app/package.json ./package.json

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3001

# Health check for container runtime (Docker/K8s liveness fallback)
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/healthz || exit 1

CMD ["node", "dist-server/index.mjs"]
