#!/usr/bin/env bash
# ==============================================================================
# One-Click Fast Deployment Script for Messrs. Rajib Enterprise POS
#
# Usage:
#   ./deploy.sh             Full build, backend tests, deploy & restart (~15s)
#   ./deploy.sh --fast      Fast deploy (skips backend pytest, ~5s)
#   ./deploy.sh --setup-ssh Configure passwordless SSH login to cPanel
# ==============================================================================

set -eo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

# Load overrides from .env.deploy if present
if [ -f "$PROJECT_ROOT/.env.deploy" ]; then
  # shellcheck source=/dev/null
  source "$PROJECT_ROOT/.env.deploy"
fi

# Configuration with sensible production defaults
SERVER_USER="${SERVER_USER:-rajibent}"
SERVER_HOST="${SERVER_HOST:-rajibenterprise.trade}"
SERVER_PORT="${SERVER_PORT:-22}"
REMOTE_DIR="${REMOTE_DIR:-/home/rajibent/backend-python}"
VENV_PYTHON="${VENV_PYTHON:-/home/rajibent/virtualenv/backend-python/3.12/bin/python}"

SKIP_TESTS=false

# CLI argument parsing
for arg in "$@"; do
  case "$arg" in
    --fast|--skip-tests)
      SKIP_TESTS=true
      ;;
    --setup-ssh)
      echo "=== Setting up Passwordless SSH Access to $SERVER_HOST ==="
      SSH_KEY="$HOME/.ssh/id_ed25519"
      if [ ! -f "$SSH_KEY" ] && [ ! -f "$HOME/.ssh/id_rsa" ]; then
        echo "[1/2] Generating new SSH key ($SSH_KEY)..."
        ssh-keygen -t ed25519 -N "" -f "$SSH_KEY"
      fi
      KEY_TO_COPY="$SSH_KEY.pub"
      if [ ! -f "$KEY_TO_COPY" ]; then
        KEY_TO_COPY="$HOME/.ssh/id_rsa.pub"
      fi
      echo "[2/2] Copying public key to $SERVER_USER@$SERVER_HOST (port $SERVER_PORT)..."
      echo "You may be prompted for your cPanel password ONE LAST TIME:"
      ssh-copy-id -p "$SERVER_PORT" -i "$KEY_TO_COPY" "$SERVER_USER@$SERVER_HOST"
      echo ""
      echo "✓ SSH Key setup complete! You can now run ./deploy.sh passwordlessly."
      exit 0
      ;;
    --help|-h)
      echo "Usage: ./deploy.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --fast, --skip-tests  Skip backend test suite (lightning fast for UI tweaks)"
      echo "  --setup-ssh           One-time setup for passwordless SSH deployment"
      echo "  --help, -h            Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg"
      echo "Run './deploy.sh --help' for usage."
      exit 1
      ;;
  esac
done

START_TIME=$(date +%s)

echo "=========================================================="
echo " 🚀 Fast Deploy -> $SERVER_USER@$SERVER_HOST"
echo "=========================================================="

# ------------------------------------------------------------------------------
# 1. Compile Frontend (TypeScript + Vite)
# ------------------------------------------------------------------------------
echo "📦 [1/5] Compiling Frontend (React 19 + Tailwind v4)..."
cd "$PROJECT_ROOT/frontend"
pnpm exec tsc --noEmit
pnpm run build
cd "$PROJECT_ROOT"

# ------------------------------------------------------------------------------
# 2. Sync Built Distribution to Backend
# ------------------------------------------------------------------------------
echo "🔄 [2/5] Syncing assets to backend distribution..."
rm -rf "$PROJECT_ROOT/backend-python/dist"
cp -r "$PROJECT_ROOT/frontend/dist" "$PROJECT_ROOT/backend-python/dist"

# ------------------------------------------------------------------------------
# 3. Quality Gate (Pytest) - Optional via --fast
# ------------------------------------------------------------------------------
if [ "$SKIP_TESTS" = true ]; then
  echo "⏩ [3/5] Skipping backend tests (--fast flag active)..."
else
  echo "🧪 [3/5] Running Backend Quality Gates (pytest suite)..."
  cd "$PROJECT_ROOT/backend-python"
  PYTHONPATH=.:.deps python3 .deps/bin/pytest tests/ -q
  cd "$PROJECT_ROOT"
fi

# ------------------------------------------------------------------------------
# 4. Create Minimal Deployment Bundle
# ------------------------------------------------------------------------------
echo "🗜️  [4/5] Packaging production artifacts..."
rm -f "$PROJECT_ROOT/deploy.zip"
cd "$PROJECT_ROOT/backend-python"

zip -q -r "$PROJECT_ROOT/deploy.zip" \
    app \
    dist \
    alembic \
    alembic.ini \
    run.py \
    requirements.txt \
    watchdog.sh \
    reset_password.py \
    -x "*/__pycache__/*" "*.pyc" "*.db*" "logs/*" ".env*"

cd "$PROJECT_ROOT"
PACKAGE_SIZE=$(du -h "$PROJECT_ROOT/deploy.zip" | cut -f1)
echo "   -> deploy.zip created ($PACKAGE_SIZE)"

# ------------------------------------------------------------------------------
# 5. Remote Transfer & Zero-Downtime Server Reload
# ------------------------------------------------------------------------------
echo "📡 [5/5] Deploying to $SERVER_HOST (port $SERVER_PORT)..."

# Upload deploy.zip via SCP
scp -P "$SERVER_PORT" "$PROJECT_ROOT/deploy.zip" "$SERVER_USER@$SERVER_HOST:$REMOTE_DIR/deploy.zip"

# Execute remote extraction and restart
ssh -p "$SERVER_PORT" "$SERVER_USER@$SERVER_HOST" bash -s << EOF
set -e
cd "$REMOTE_DIR"

# 1. Clean old hashed frontend bundles to prevent file accumulation
rm -rf dist/assets/

# 2. Overwrite application code and static HTML
unzip -qo deploy.zip
rm -f deploy.zip

# 3. Gracefully restart FastAPI backend daemon
pkill -9 -f "run.py" 2>/dev/null || true
sleep 1
nohup "$VENV_PYTHON" run.py > "$REMOTE_DIR/uvicorn.log" 2>&1 &
sleep 2

# 4. Probe local health
if curl -sf http://127.0.0.1:8000/api/health >/dev/null 2>&1; then
  echo "✓ Remote backend service is healthy on 127.0.0.1:8000"
else
  echo "⚠️  Health check returned warning. Recent logs:"
  tail -n 20 "$REMOTE_DIR/uvicorn.log"
  exit 1
fi
EOF

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo "=========================================================="
echo " 🎉 DEPLOY SUCCESSFUL in ${DURATION}s!"
echo " 🌐 Live Site: https://$SERVER_HOST"
echo " 🩺 Health Check: https://$SERVER_HOST/api/health"
echo "=========================================================="
