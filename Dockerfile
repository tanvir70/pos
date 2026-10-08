# ==============================================================================
# Multi-stage Production Dockerfile for Rajib Enterprise POS
# ==============================================================================

# Stage 1: Build the React 19 Frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /build

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY frontend/package.json frontend/pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install

COPY frontend/ ./
RUN pnpm run build

# Stage 2: Production Python Backend + Embedded Frontend
FROM python:3.12-slim AS runner

WORKDIR /app

# Install runtime system packages for Pillow / SQLite / Curl healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libjpeg62-turbo \
    zlib1g \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend-python/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application code
COPY backend-python/ ./

# Copy compiled frontend SPA bundle into backend dist folder
COPY --from=frontend-builder /build/dist ./dist

# Create persistent data and logs directory
RUN mkdir -p /app/data /app/logs

# Set production environment variables
ENV PYTHONUNBUFFERED=1 \
    ENVIRONMENT=production \
    PORT=8000 \
    HOST=0.0.0.0 \
    DATABASE_URL=sqlite+aiosqlite:////app/data/pos.db \
    SYNC_DATABASE_URL=sqlite:////app/data/pos.db

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/api/health || exit 1

CMD ["python", "run.py"]
