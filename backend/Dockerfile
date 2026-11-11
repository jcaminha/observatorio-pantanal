FROM python:3.13-slim

ENV PYTHONUNBUFFERED=1 PYTHONPATH=/app PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /app

COPY pyproject.toml ./
COPY observatorio ./observatorio
RUN pip install ".[gee,dev]"

COPY alembic.ini ./
COPY migrations ./migrations
COPY tests ./tests

RUN useradd --system --uid 10001 obs
USER obs

EXPOSE 8000
CMD ["uvicorn", "observatorio.api.app:app", "--host", "0.0.0.0", "--port", "8000"]
