#!/bin/bash
# ============================================================================
# POS Daemon Watchdog
# Automatically starts / revives the Uvicorn server if it stops or server reboots.
# ============================================================================

APP_DIR="/home/rajibent/backend-python"
VENV_PYTHON="/home/rajibent/virtualenv/backend-python/3.12/bin/python"
LOG_FILE="$APP_DIR/uvicorn.log"
PORT=8000

# Check if process is listening on port 8000 or running run.py
if ! pgrep -f "$VENV_PYTHON run.py" > /dev/null && ! curl -s -m 2 http://127.0.0.1:$PORT/api/health > /dev/null; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') [WATCHDOG] Uvicorn is down. Reviving..." >> "$APP_DIR/logs/watchdog.log"
    cd "$APP_DIR" || exit 1
    nohup "$VENV_PYTHON" run.py >> "$LOG_FILE" 2>&1 &
    echo "$(date '+%Y-%m-%d %H:%M:%S') [WATCHDOG] Started with PID $!" >> "$APP_DIR/logs/watchdog.log"
fi
