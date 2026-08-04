# WestGuardQC common commands.
# Backend recipes use the project virtualenv. On Linux/mac, override with:
#   make test VENV_PY=.venv/bin/python
VENV_PY ?= .venv/Scripts/python.exe

# The test fixtures drop and recreate every table, so they run against their own
# database. Create it once with:
#   docker compose exec db createdb -U westguard westguardqc_test
TEST_DATABASE_URL ?= postgresql+asyncpg://westguard:westguard@localhost:5432/westguardqc_test

.PHONY: help up down demo db migrate seed backend frontend test lint format

help:
	@echo "Whole stack in containers:"
	@echo "  up        build and start db, migrations, API, and web on :8080"
	@echo "  demo      up plus seeded demo data"
	@echo "  down      stop the stack (add ARGS=-v to drop the database volume)"
	@echo ""
	@echo "Local development, with hot reload:"
	@echo "  db        start PostgreSQL only"
	@echo "  migrate   apply Alembic migrations"
	@echo "  seed      populate demo data"
	@echo "  backend   run the FastAPI dev server on :8000"
	@echo "  frontend  run the Vite dev server on :5173"
	@echo ""
	@echo "Checks:"
	@echo "  test      run backend (pytest) and frontend (vitest) tests"
	@echo "  lint      ruff + mypy + eslint + prettier checks"
	@echo "  format    apply ruff and prettier formatting"

up:
	docker compose up -d --build

demo: up
	docker compose --profile seed run --rm seed

down:
	docker compose down $(ARGS)

db:
	docker compose up -d db

migrate:
	cd backend && $(VENV_PY) -m alembic upgrade head

seed:
	cd backend && $(VENV_PY) -m app.seed

backend:
	cd backend && $(VENV_PY) -m uvicorn app.main:app --reload --port 8000

frontend:
	cd frontend && npm run dev

test: export DATABASE_URL := $(TEST_DATABASE_URL)
test:
	cd backend && $(VENV_PY) -m pytest
	cd frontend && npm test

lint:
	cd backend && $(VENV_PY) -m ruff check . && $(VENV_PY) -m ruff format --check . && $(VENV_PY) -m mypy app tests
	cd frontend && npm run lint && npm run format:check

format:
	cd backend && $(VENV_PY) -m ruff format .
	cd frontend && npm run format
