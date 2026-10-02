#!/usr/bin/env bash
set -e

# ==============================================================================
# Automated Build & Packaging Script for Messrs. Rajib Enterprise POS
# Usage: ./deploy_package.sh
# Creates: deploy.zip (ready for upload to cPanel /home/rajibent/backend-python)
# ==============================================================================

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

echo "=========================================================="
echo "  [1/4] Checking and Compiling Frontend (React 19 + Vite)"
echo "=========================================================="
cd "$PROJECT_ROOT/frontend"
pnpm exec tsc --noEmit
pnpm run build
cd "$PROJECT_ROOT"

echo "=========================================================="
echo "  [2/4] Syncing Built Frontend into Backend Distribution"
echo "=========================================================="
rm -rf "$PROJECT_ROOT/backend-python/dist"
cp -r "$PROJECT_ROOT/frontend/dist" "$PROJECT_ROOT/backend-python/dist"

echo "=========================================================="
echo "  [3/4] Running Backend Quality Gates (pytest suite)"
echo "=========================================================="
cd "$PROJECT_ROOT/backend-python"
PYTHONPATH=.:.deps python3 .deps/bin/pytest tests/ -q
cd "$PROJECT_ROOT"

echo "=========================================================="
echo "  [4/4] Generating Production deploy.zip Package"
echo "=========================================================="
rm -f "$PROJECT_ROOT/deploy.zip"
cd "$PROJECT_ROOT/backend-python"

zip -r "$PROJECT_ROOT/deploy.zip" \
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

echo "=========================================================="
echo " SUCCESS! Production package created:"
echo " -> $PROJECT_ROOT/deploy.zip ($(du -h "$PROJECT_ROOT/deploy.zip" | cut -f1))"
echo "=========================================================="
echo ""
echo "Next Steps on cPanel (rajibenterprise.trade):"
echo "1. Upload 'deploy.zip' to /home/rajibent/backend-python/ (via cPanel File Manager or scp)"
echo "2. In cPanel Terminal, execute:"
echo "   cd /home/rajibent/backend-python"
echo "   unzip -o deploy.zip"
echo "   pkill -f \"python run.py\" 2>/dev/null"
echo "   nohup /home/rajibent/virtualenv/backend-python/3.12/bin/python run.py > /home/rajibent/backend-python/uvicorn.log 2>&1 &"
echo "   curl -i http://127.0.0.1:8000/api/health"
echo "=========================================================="
