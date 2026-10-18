# ---------- Stage 1: сборка зависимостей ----------
FROM python:3.12-slim AS builder

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Оптимизации для uv в Docker
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never

WORKDIR /app

# Сначала копируем только файлы зависимостей — для кеширования слоев
COPY pyproject.toml uv.lock ./

# Устанавливаем зависимости без самого проекта (кешируемый слой)
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project --no-dev

# Теперь копируем код и устанавливаем проект
COPY . .
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev


# ---------- Stage 2: финальный образ ----------
FROM python:3.12-slim

WORKDIR /app

# Копируем готовое окружение и код из builder
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app /app

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

EXPOSE 8000

# Entrypoint: применяем миграции и запускаем uvicorn
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]