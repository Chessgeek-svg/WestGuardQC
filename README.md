# WestGuardQC

A clinical laboratory QC monitoring dashboard. WestGuardQC applies Westgard multi-rule evaluation to quality control results as they are entered and presents them on Levey-Jennings charts, so out-of-control events are caught at the bench instead of during a monthly review.

This is a ground-up rebuild of an earlier prototype, with a focus on clean architecture, typed code, and a test suite that runs in CI from the first commit.

> **Educational use only.** This software has not been validated for clinical use under CLIA '88 or ISO 15189. Do not use it for patient diagnostic decisions.

## Status

Phase 1: project scaffold. The backend serves a health check, the frontend renders a placeholder page, and CI enforces linting, type checking, and tests on both. Domain features (QC lots, result ingestion, Westgard rule engine, Levey-Jennings charts) arrive in later phases.

## Stack

| Layer      | Technology                                            |
| ---------- | ----------------------------------------------------- |
| API        | FastAPI on Python 3.11+, fully type-hinted            |
| ORM        | SQLAlchemy 2.0 (async, asyncpg driver)                |
| Migrations | Alembic (async template)                              |
| Database   | PostgreSQL 16                                         |
| Frontend   | React 19 + TypeScript (strict), Vite, Tailwind CSS v4 |
| Testing    | pytest + pytest-asyncio, Vitest + Testing Library     |
| Tooling    | ruff, mypy (strict), ESLint, Prettier, pre-commit     |
| CI         | GitHub Actions                                        |

## Architecture overview

```
WestGuardQC/
├── backend/
│   ├── app/
│   │   ├── api/          # Routers, one module per resource
│   │   ├── config.py     # Settings from environment variables (pydantic-settings)
│   │   ├── db.py         # Async engine, session factory, declarative Base
│   │   └── main.py       # FastAPI application entry point
│   ├── alembic/          # Migration environment (async)
│   ├── tests/            # pytest suite
│   ├── Dockerfile
│   └── pyproject.toml    # Dependencies plus ruff, mypy, pytest config
├── frontend/
│   ├── src/              # React application (strict TypeScript)
│   └── package.json
├── docker-compose.yml    # Postgres + backend for local dev
└── .github/workflows/    # CI pipeline
```

The backend owns all business logic and exposes a JSON API. The frontend is a separate Vite application that talks to the API over HTTP. Configuration flows exclusively through environment variables; every setting has a default that works against the docker-compose stack, so a fresh clone runs without any manual configuration.

## Local development

### Prerequisites

- Docker and Docker Compose
- Python 3.11+ and Node 20+ if you want to run the apps outside containers

### Quick start with Docker

```bash
docker compose up --build
```

This starts PostgreSQL 16 and the FastAPI backend. Verify with:

```bash
curl http://localhost:8000/health
# {"status":"ok"}
```

API docs are served at http://localhost:8000/docs.

### Backend without Docker

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

The backend reads `DATABASE_URL` from the environment and falls back to the docker-compose Postgres (`postgresql+asyncpg://westguard:westguard@localhost:5432/westguardqc`). You can run just the database in Docker:

```bash
docker compose up db
```

Apply migrations with:

```bash
alembic upgrade head
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The dev server runs at http://localhost:5173.

## Quality checks

Backend, from `backend/` with the venv active:

```bash
ruff check .          # lint
ruff format --check . # formatting
mypy app tests        # strict type checking
pytest                # tests
```

Frontend, from `frontend/`:

```bash
npm run lint          # eslint
npm run format:check  # prettier
npm test              # vitest
npm run build         # type-check and production build
```

### Pre-commit hooks

```bash
pip install pre-commit
pre-commit install
```

Hooks run ruff, mypy, eslint, and prettier on every commit. The mypy hook uses whichever `mypy` is on your PATH, so activate the backend venv before committing.

## CI

Every push to `main` and every pull request runs two jobs:

- **backend**: ruff, mypy, and pytest against a PostgreSQL 16 service container
- **frontend**: eslint, prettier check, vitest, and a type-checked production build

## License

MIT. See [LICENSE](LICENSE). The license does not convey regulatory clearance for medical use.
