# ═══════════════════════════════════════════════════════
# Multi-stage Dockerfile for Frontend (Vite + React)
# Builds static assets and serves via nginx
# ═══════════════════════════════════════════════════════

# ── Stage 1: Build ────────────────────────────────────
FROM node:22-slim AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files first for better caching
COPY frontend/package.json frontend/pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY frontend/ ./

# Build static assets
# VITE_API_URL is empty — frontend uses relative /api paths proxied by nginx
ENV VITE_API_URL=""
RUN pnpm run build

# ── Stage 2: Serve with nginx ─────────────────────────
FROM nginx:alpine AS runtime

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost:80/index.html || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
