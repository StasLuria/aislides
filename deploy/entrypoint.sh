#!/bin/bash
# ═══════════════════════════════════════════════════════
# Entrypoint for Render.com production container
# Starts nginx (frontend proxy) + uvicorn (backend API)
# ═══════════════════════════════════════════════════════
set -e

PORT="${PORT:-10000}"

echo "🚀 Starting AI Presentation Generator (port: $PORT)"

# ── Step 1: Render nginx config from template ────────
# Replace ${PORT} in nginx config template
envsubst '${PORT}' < /etc/nginx/templates/default.conf.template > /etc/nginx/sites-enabled/default

# Remove default nginx config if exists
rm -f /etc/nginx/sites-enabled/default.bak

# Test nginx config
nginx -t

# ── Step 2: Start uvicorn (backend) in background ────
echo "📡 Starting uvicorn on 127.0.0.1:8000..."
uvicorn backend.app.main:app \
    --host 127.0.0.1 \
    --port 8000 \
    --workers 2 \
    --log-level info &

UVICORN_PID=$!

# Wait for uvicorn to be ready (check /api/health on uvicorn directly)
echo "⏳ Waiting for backend to start..."
for i in $(seq 1 60); do
    if curl -sf http://127.0.0.1:8000/api/health > /dev/null 2>&1; then
        echo "✅ Backend is ready (attempt $i)"
        break
    fi
    if [ "$i" -eq 60 ]; then
        echo "❌ Backend failed to start within 60 seconds"
        # Show uvicorn logs for debugging
        echo "--- Last uvicorn output ---"
        kill $UVICORN_PID 2>/dev/null || true
        exit 1
    fi
    sleep 1
done

# ── Step 3: Start nginx (frontend) in foreground ─────
echo "🌐 Starting nginx on port $PORT..."
nginx -g "daemon off;" &

NGINX_PID=$!

echo "✅ All services started. Nginx PID=$NGINX_PID, Uvicorn PID=$UVICORN_PID"

# ── Step 4: Wait for either process to exit ──────────
# If either process dies, kill the other and exit
wait -n $UVICORN_PID $NGINX_PID
EXIT_CODE=$?

echo "⚠️ Process exited with code $EXIT_CODE, shutting down..."
kill $UVICORN_PID $NGINX_PID 2>/dev/null || true
wait

exit $EXIT_CODE
