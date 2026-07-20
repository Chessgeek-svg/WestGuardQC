# WestGuardQC common commands.
# Backend recipes use the project virtualenv. On Linux/mac, override with:
#   make test VENV_PY=.venv/bin/python
VENV_PY ?= .venv/Scripts/python.exe

.PHONY: help db migrate seed backend frontend test lint format

help:
	@echo "Targets:"
	@echo "  db        start PostgreSQL (docker compose)"
	@echo "  migrate   apply Alembic migrations"
	@echo "  seed      populate demo data"
	@echo "  backend   run the FastAPI dev server on :8000"
	@echo "  frontend  run the Vite dev server on :5173"
	@echo "  test      run backend (pytest) and frontend (vitest) tests"
	@echo "  lint      ruff + mypy + eslint + prettier checks"
	@echo "  format    apply ruff and prettier formatting"

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

test:
	cd backend && $(VENV_PY) -m pytest
	cd frontend && npm test

lint:
	cd backend && $(VENV_PY) -m ruff check . && $(VENV_PY) -m ruff format --check . && $(VENV_PY) -m mypy app tests
	cd frontend && npm run lint && npm run format:check

format:
	cd backend && $(VENV_PY) -m ruff format .
	cd frontend && npm run format
