# ═══════════════════════════════════════════════════════
# Multi-stage Dockerfile for Presentation Frontend
# Builds static assets and serves via nginx
# ═══════════════════════════════════════════════════════

# ── Stage 1: Build ────────────────────────────────────
FROM node:22-slim AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

# Copy package files first for better caching
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY client/ ./client/
COPY server/ ./server/
COPY shared/ ./shared/
COPY vite.config.ts tsconfig.json ./

# Build static assets
RUN pnpm run build

# ── Stage 2: Serve with nginx ─────────────────────────
FROM nginx:alpine AS runtime

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder
COPY --from=builder /app/dist/public /usr/share/nginx/html

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost:80/index.html || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
