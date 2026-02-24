#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════
# sandbox-up.sh — Запуск AI Presentation Generator в sandbox Manus
#
# Использование:
#   ./scripts/sandbox-up.sh        # Запуск backend + frontend
#   ./scripts/sandbox-up.sh stop   # Остановка всех процессов
#   ./scripts/sandbox-up.sh status # Проверка статуса
# ═══════════════════════════════════════════════════════

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_PORT=8000
FRONTEND_PORT=3000
BACKEND_LOG="/tmp/sandbox-backend.log"
FRONTEND_LOG="/tmp/sandbox-frontend.log"
BACKEND_PID_FILE="/tmp/sandbox-backend.pid"
FRONTEND_PID_FILE="/tmp/sandbox-frontend.pid"

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info()  { echo -e "${BLUE}[INFO]${NC}  $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ─── Остановка ────────────────────────────────────────
stop_services() {
    log_info "Останавливаю сервисы..."

    if [ -f "$BACKEND_PID_FILE" ]; then
        PID=$(cat "$BACKEND_PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            kill "$PID" 2>/dev/null || true
            sleep 1
            kill -9 "$PID" 2>/dev/null || true
            log_ok "Backend (PID $PID) остановлен"
        fi
        rm -f "$BACKEND_PID_FILE"
    fi

    if [ -f "$FRONTEND_PID_FILE" ]; then
        PID=$(cat "$FRONTEND_PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            kill "$PID" 2>/dev/null || true
            sleep 1
            kill -9 "$PID" 2>/dev/null || true
            log_ok "Frontend (PID $PID) остановлен"
        fi
        rm -f "$FRONTEND_PID_FILE"
    fi

    # Убиваем все оставшиеся процессы uvicorn и vite
    pkill -f "uvicorn backend.app.main:app" 2>/dev/null || true
    pkill -f "vite" 2>/dev/null || true

    log_ok "Все сервисы остановлены"
}

# ─── Статус ───────────────────────────────────────────
check_status() {
    echo ""
    echo "═══════════════════════════════════════════"
    echo "  AI Presentation Generator — Status"
    echo "═══════════════════════════════════════════"

    # Backend
    if [ -f "$BACKEND_PID_FILE" ] && kill -0 "$(cat "$BACKEND_PID_FILE")" 2>/dev/null; then
        log_ok "Backend:  RUNNING (PID $(cat "$BACKEND_PID_FILE")) on port $BACKEND_PORT"
    else
        log_error "Backend:  NOT RUNNING"
    fi

    # Frontend
    if [ -f "$FRONTEND_PID_FILE" ] && kill -0 "$(cat "$FRONTEND_PID_FILE")" 2>/dev/null; then
        log_ok "Frontend: RUNNING (PID $(cat "$FRONTEND_PID_FILE")) on port $FRONTEND_PORT"
    else
        log_error "Frontend: NOT RUNNING"
    fi

    # Health check
    if curl -s "http://localhost:$BACKEND_PORT/health" >/dev/null 2>&1; then
        log_ok "Backend health: OK"
    else
        log_warn "Backend health: UNAVAILABLE"
    fi

    if curl -s "http://localhost:$FRONTEND_PORT" >/dev/null 2>&1; then
        log_ok "Frontend health: OK"
    else
        log_warn "Frontend health: UNAVAILABLE"
    fi

    echo ""
}

# ─── Запуск ───────────────────────────────────────────
start_services() {
    echo ""
    echo "═══════════════════════════════════════════"
    echo "  AI Presentation Generator — Sandbox Up"
    echo "═══════════════════════════════════════════"
    echo ""

    cd "$PROJECT_DIR"

    # 1. Проверяем .env
    if [ ! -f ".env" ]; then
        log_warn ".env не найден, создаю из .env.example..."
        if [ -f ".env.example" ]; then
            cp .env.example .env
            # Подставляем OPENAI_API_KEY из окружения если есть
            if [ -n "${OPENAI_API_KEY:-}" ]; then
                sed -i "s|^OPENAI_API_KEY=.*|OPENAI_API_KEY=$OPENAI_API_KEY|" .env
                log_ok "OPENAI_API_KEY подставлен из окружения"
            fi
        else
            cat > .env <<EOF
DATABASE_URL=sqlite+aiosqlite:///./data/app.db
JWT_SECRET_KEY=dev-secret-key-change-in-production
OPENAI_API_KEY=${OPENAI_API_KEY:-}
DEBUG=true
EOF
        fi
        log_ok ".env создан"
    fi

    # 2. Создаём директорию для SQLite
    mkdir -p data
    log_ok "Директория data/ готова"

    # 3. Останавливаем старые процессы
    stop_services 2>/dev/null || true

    # 4. Проверяем зависимости backend
    log_info "Проверяю зависимости backend..."
    if ! poetry run python -c "import fastapi" 2>/dev/null; then
        log_info "Устанавливаю backend зависимости..."
        poetry install --no-interaction 2>&1 | tail -3
    fi
    log_ok "Backend зависимости готовы"

    # 5. Проверяем зависимости frontend
    log_info "Проверяю зависимости frontend..."
    if [ ! -d "frontend/node_modules" ]; then
        log_info "Устанавливаю frontend зависимости..."
        cd frontend && pnpm install 2>&1 | tail -3 && cd ..
    fi
    log_ok "Frontend зависимости готовы"

    # 6. Запускаем backend
    log_info "Запускаю backend на порту $BACKEND_PORT..."
    cd "$PROJECT_DIR"
    nohup poetry run uvicorn backend.app.main:app \
        --host 0.0.0.0 \
        --port "$BACKEND_PORT" \
        --reload \
        > "$BACKEND_LOG" 2>&1 &
    echo $! > "$BACKEND_PID_FILE"
    log_ok "Backend запущен (PID $(cat "$BACKEND_PID_FILE"))"

    # Ждём готовности backend
    log_info "Ожидаю готовность backend..."
    for i in $(seq 1 15); do
        if curl -s "http://localhost:$BACKEND_PORT/health" >/dev/null 2>&1; then
            log_ok "Backend готов!"
            break
        fi
        if [ "$i" -eq 15 ]; then
            log_error "Backend не запустился за 15 секунд. Логи: $BACKEND_LOG"
            tail -20 "$BACKEND_LOG"
            exit 1
        fi
        sleep 1
    done

    # 7. Запускаю frontend
    log_info "Запускаю frontend на порту $FRONTEND_PORT..."
    cd "$PROJECT_DIR/frontend"
    nohup npx vite --host 0.0.0.0 --port "$FRONTEND_PORT" \
        > "$FRONTEND_LOG" 2>&1 &
    echo $! > "$FRONTEND_PID_FILE"
    log_ok "Frontend запущен (PID $(cat "$FRONTEND_PID_FILE"))"

    # Ждём готовности frontend
    log_info "Ожидаю готовность frontend..."
    for i in $(seq 1 15); do
        if curl -s "http://localhost:$FRONTEND_PORT" >/dev/null 2>&1; then
            log_ok "Frontend готов!"
            break
        fi
        if [ "$i" -eq 15 ]; then
            log_error "Frontend не запустился за 15 секунд. Логи: $FRONTEND_LOG"
            tail -20 "$FRONTEND_LOG"
            exit 1
        fi
        sleep 1
    done

    cd "$PROJECT_DIR"

    # 8. Итог
    echo ""
    echo "═══════════════════════════════════════════"
    echo -e "  ${GREEN}✅ Всё запущено!${NC}"
    echo "═══════════════════════════════════════════"
    echo ""
    echo "  Backend:  http://localhost:$BACKEND_PORT"
    echo "  Frontend: http://localhost:$FRONTEND_PORT"
    echo ""
    echo "  Логи backend:  $BACKEND_LOG"
    echo "  Логи frontend: $FRONTEND_LOG"
    echo ""
    echo "  Остановить:  make sandbox-down"
    echo "  Статус:      make sandbox-status"
    echo ""
}

# ─── Main ─────────────────────────────────────────────
case "${1:-start}" in
    start)   start_services ;;
    stop)    stop_services ;;
    status)  check_status ;;
    restart) stop_services; sleep 2; start_services ;;
    *)
        echo "Usage: $0 {start|stop|status|restart}"
        exit 1
        ;;
esac
