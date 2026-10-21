#!/bin/sh
set -e

# ждём Redis (на случай прямого запуска без compose)
python - <<'PY'
import os, time, redis
url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
for i in range(30):
    try:
        redis.from_url(url, socket_connect_timeout=1).ping()
        break
    except Exception:
        time.sleep(1)
else:
    raise SystemExit("Redis is not reachable")
PY

echo "Running database migrations..."
alembic upgrade head

echo "Starting FastAPI..."
exec uvicorn backend.main:app --host 0.0.0.0 --port 8000