# ═══════════════════════════════════════════════════════
# Multi-stage Dockerfile for Backend (FastAPI + Poetry)
# ═══════════════════════════════════════════════════════

# ── Stage 1: Build dependencies ──────────────────────
FROM python:3.11-slim AS builder

WORKDIR /app

# Install system dependencies for WeasyPrint and bcrypt
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    libffi-dev \
    libcairo2 \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN pip install --no-cache-dir poetry==1.8.5

# Copy dependency files
COPY pyproject.toml poetry.lock ./

# Export requirements and install (without dev dependencies)
RUN poetry export --without dev --format requirements.txt --output requirements.txt \
    && pip install --no-cache-dir -r requirements.txt

# ── Stage 2: Runtime ─────────────────────────────────
FROM python:3.11-slim AS runtime

WORKDIR /app

# Install runtime system dependencies for WeasyPrint
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    libcairo2 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application code
COPY backend/ ./backend/
COPY engine/ ./engine/
COPY tools/ ./tools/
COPY schemas/ ./schemas/
COPY data/ ./data/
COPY configs/ ./configs/

# Create non-root user
RUN useradd --create-home --shell /bin/bash appuser \
    && mkdir -p /app/data /app/storage \
    && chown -R appuser:appuser /app

USER appuser

# Environment defaults
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
