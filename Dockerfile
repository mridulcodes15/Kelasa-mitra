# Kelasa Mitra: one container serving the API and the built frontend.
#
# Rules-only by default: with no ORCHESTRATE_* or GROQ_* variables set, nothing leaves the
# container (the agent panel shows the "agent offline" banner; the cards come from the rules).
#
#   docker build -t kelasa-mitra .
#   docker run --rm -p 8000:8000 kelasa-mitra        # http://localhost:8000, health: /health
#
# The server listens on $PORT (default 8000).

# ── 1. Build the frontend ─────────────────────────────────────────────────────
FROM node:22-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── 2. Python runtime ────────────────────────────────────────────────────────
FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=8000
WORKDIR /app

COPY backend/requirements.txt backend/requirements.txt
RUN pip install -r backend/requirements.txt

# UID 1000: Hugging Face Spaces run the container as user 1000, so the files must be theirs.
RUN useradd --create-home --uid 1000 app
COPY --chown=app:app backend/ backend/
RUN chmod -R u+w /app/backend/db
COPY --from=frontend --chown=app:app /app/frontend/dist frontend/dist

# Runs as a non-root user. The SQLite file is created and seeded in backend/db on start.
USER app
WORKDIR /app/backend
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD python -c "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:%s/health' % os.environ.get('PORT', '8000'), timeout=4)"

# --proxy-headers: behind the host's proxy, the rate limit sees the visitor's IP, not the proxy's.
CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
