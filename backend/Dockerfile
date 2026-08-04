FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY pyproject.toml ./
COPY app ./app
RUN pip install --no-cache-dir .

COPY alembic.ini ./
COPY alembic ./alembic

# Run as an unprivileged user. Nothing here writes to the image at runtime, so
# the application files stay owned by root and read-only to the process.
RUN useradd --create-home --uid 10001 westguard
USER westguard

EXPOSE 8000

# 127.0.0.1 rather than localhost, which resolves to ::1 first in the container.
HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=10 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health').read()"]

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
