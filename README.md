# WestGuardQC

Levey-Jennings QC monitoring for a clinical laboratory, with Westgard multi-rule evaluation applied the moment a result is entered.

When a technologist records a control value, WestGuardQC scores it against the lot's recent history and hands back a verdict right away. The point is to catch an out-of-control run at the bench, while the analyzer is still in front of you, rather than during a monthly QC review three weeks later.

> **Educational use only.** This software has not been validated for clinical use under CLIA '88 or ISO 15189. Do not use it to make patient diagnostic decisions.

## Background

Labs run quality control material alongside patient samples. QC material is a manufactured sample with a known concentration, so if the analyzer reports the wrong number for it, you know the patient results from that run are suspect too. Each lot of QC material ships with a target mean and standard deviation from the manufacturer's package insert, usually refined against the lab's own accumulated data. Comparing what the lab actually observes to those targets is how you tell whether a method has drifted.

A Levey-Jennings chart plots those control results over time, with horizontal lines at the mean and at ±1, 2, and 3 SD. Shifts, trends, and widening scatter are obvious on it in a way they never are in a column of numbers.

Westgard rules are the standard multi-rule system for turning that chart into an accept or reject decision. WestGuardQC implements the classic six:

| Rule | Trigger | Interpretation |
| ---- | ------- | -------------- |
| 1-2s | One result beyond ±2 SD | Warning. Flags the run for a closer look, does not reject it. |
| 1-3s | One result beyond ±3 SD | Reject. Random error. |
| 2-2s | Two consecutive results beyond the same ±2 SD limit | Reject. Systematic error. |
| R-4s | Two consecutive results spanning more than 4 SD, one past +2s and one past -2s | Reject. Random error. |
| 4-1s | Four consecutive results beyond the same ±1 SD limit | Reject. Systematic error. |
| 10x | Ten consecutive results on the same side of the mean | Reject. Systematic bias. |

A result that trips only 1-2s is accepted with a warning. Anything else rejects the run. All violated rules are reported rather than just the first match, since a point beyond 3 SD is also, trivially, beyond 2 SD, and the reviewer should see both.

## Quick start

Docker alone is enough to see the whole thing running with demo data in it:

```bash
docker compose up -d --build
docker compose --profile seed run --rm seed
```

Open http://localhost:8080. Interactive API docs are at http://localhost:8000/docs. `make demo` does both commands, and `make down` stops the stack.

Four services come up in order. Postgres starts, `migrate` applies every Alembic revision and exits, the API waits for that to finish and then reports healthy, and nginx serves the built frontend once the API is answering. Seeding is behind a profile because it drops the QC tables first, so it never runs by surprise.

### Working on it

Containers give you no hot reload, so development runs the two dev servers directly against the containerized database. You need Python 3.11+ and Node 20+ for this.

```bash
make db # start PostgreSQL in Docker
make migrate # apply Alembic migrations
make seed # populate demo data
make backend # FastAPI on :8000 (separate terminal)
make frontend # Vite on :5173 (separate terminal)
```

That serves the app on http://localhost:5173, separate from the container stack's 8080, so you can tell at a glance which one you are looking at.

The Makefile's backend targets assume a virtualenv at `backend/.venv`. On Linux and macOS, pass `VENV_PY=.venv/bin/python`.

Without `make`:

```bash
docker compose up -d db

cd backend
python -m venv .venv
source .venv/bin/activate # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload
```

```bash
cd frontend
npm install
npm run dev
```

Every setting reads from the environment and has a default that works, so a fresh clone needs no configuration file. The backend takes `DATABASE_URL` (default `postgresql+asyncpg://westguard:westguard@localhost:5432/westguardqc`). The frontend takes an optional `VITE_API_BASE`, which stays unset in both setups: the Vite dev server proxies `/api` to port 8000 and nginx proxies it to the API container, so the app is same-origin either way and the backend ships no CORS middleware.

### Demo data

Seeding resets the QC tables and writes four analytes across six lots, each with about 28 days of daily results. A fixed RNG seed makes the data identical on every run, and every value goes through the real Westgard engine on its way in, so the statuses you see are the ones the app actually computes. The lots are picked to cover the states worth looking at. Glucose Level 1 currently reads rejected, Sodium Level 1 reads warning, three lots are in control, and Cholesterol Level 1 has no results at all so the empty card has something to show.

## The two views

The dashboard is a grid of cards, one per active control lot, each identified by analyte, level, and lot number. A card carries a compact trendline showing just the mean and ±2 SD, the observed statistics next to the lot's targets, and the current status. Lots past their expiration date are badged. A dropdown narrows the grid to a single analyte.

Clicking a card opens lot detail: the full Levey-Jennings chart with all seven reference lines, hover tooltips giving the z-score and any violated rules, the observed-vs-target statistics table, the recent results with their violation badges, and a form for recording a new result. Submitting the form shows the verdict the new value earned before the chart refreshes.

From there you can also void a bad result or retire the lot. Both are described below.

## How it works

```mermaid
sequenceDiagram
  participant T as Technologist
  participant API as FastAPI
  participant E as Westgard engine
  participant DB as PostgreSQL
  T->>API: POST /qc-results {lot, value}
  API->>DB: load lot + prior results
  API->>E: evaluate(value, mean, sd, history)
  E-->>API: violated rules
  API->>DB: store result + violations + verdict
  API-->>T: 201 with status
```

Nothing gets written until the rules have run. The service layer pulls the nine results recorded most recently before the new one, which is as far back as any rule reaches (10x needs the current value plus nine priors). Ordering keys on `recorded_at` with the row id breaking ties, so backdating an entry judges it against whatever actually came before it in time, not whatever happened to be typed in first.

Backdating also invalidates every result after the insertion point, because those were scored against a history that has just changed. So the service walks forward from the new result and re-scores the rest of the run against a rolling window.

What lands in the database is `accepted` and the list of rule codes that fired. The status the UI shows is computed from those codes on the way out, by a computed field on the Pydantic model, to guarantee the verdict agrees with its evidence. A lot's target mean and SD ride along in the same payload as its recent results, so the frontend has everything it needs to place the reference lines without going back to the API for the lot record.

### Voiding a result

A mistyped or invalid entry is voided, never deleted. `POST /qc-results/{id}/void` takes a name and a reason and stamps them on the row, which stays in the table showing the verdict it carried at the time. What changes is that it stops counting: it drops out of rule evaluation, out of the chart, and out of the observed mean, SD, and CV. Results recorded after it are rescored without it, so a 2-2s that only held because of the voided value goes away on its own.

### Revising targets

`PATCH /qc-lots/{id}` covers the manufacturer, the targets, the expiration date, and whether the lot is active. Retiring a lot takes it off the dashboard while leaving it reachable by URL.

Revising `target_mean` or `target_sd` changes all of that level's verdicts, because every z-score in the lot is measured against those numbers. So the whole run is rescored against the new targets. Backdating, voiding, and retargeting all invalidate stored verdicts in the same way, so all three go through one `reevaluate()` that walks a lot forward from a given point, or from the beginning.

## Data model

There are three tables. An analyte is whatever is being measured, glucose or sodium or potassium. A QC lot is a batch of control material plus the target mean and SD it is supposed to produce, keyed on analyte, lot number, and level, because the same physical lot usually gets assayed at two or three concentrations and each one carries its own targets. Results hang off the lot, one row per measurement, holding the value, who ran it, when, and whichever rule codes fired.

Two columns are nullable to carry meaning. A null `accepted` means nobody has evaluated the result yet. A null `voided_at` means the result is still live, and a timestamp there means it has been withdrawn, alongside the name and reason recorded with it.

## Stack

| Layer | Technology |
| ----- | ---------- |
| API | FastAPI on Python 3.11+ |
| ORM | SQLAlchemy 2.0 (async, asyncpg) |
| Migrations | Alembic, async template |
| Database | PostgreSQL 16 |
| Frontend | React 19, TypeScript strict mode, Vite, Tailwind v4 |
| Charts | Recharts |
| Testing | pytest + pytest-asyncio, Vitest + Testing Library |
| Tooling | ruff, mypy strict, ESLint, Prettier, pre-commit |
| CI | GitHub Actions |

PostgreSQL is here for JSONB, which stores the variable-length violation list natively and indexably instead of forcing a join table or a comma-delimited string, and for window functions, which are the best way to represent "the N most recent results per lot." Recharts is useful because `ReferenceLine` and a custom dot renderer map directly onto what a Levey-Jennings chart needs. Vite's dev proxy lets the frontend call the API same-origin, which is why the backend ships no CORS middleware at all.

## Development

```bash
make lint # ruff, mypy, eslint, prettier
make test # pytest and vitest
```

Or per side. Backend, from `backend/` with the venv active:

```bash
ruff check .
ruff format --check .
mypy app tests
pytest
```

Frontend, from `frontend/`:

```bash
npm run lint
npm run format:check
npm test
npm run build # type-check plus production build
```

Backend tests need a running PostgreSQL. Each test drops and recreates the schema, which is slow, but it keeps the tests on real Postgres. JSONB columns, window functions, and check constraints behave the same way they will in production.

Because those fixtures drop every table, they refuse to run unless the database name ends in `_test`, which stops a stray `pytest` from wiping the development data. `make test` points at `westguardqc_test`; create it once with `docker compose exec db createdb -U westguard westguardqc_test`.

Pre-commit hooks are configured but not installed by default:

```bash
pip install pre-commit
pre-commit install
```

The mypy hook uses whichever `mypy` is on your PATH, so activate the backend venv before committing.

CI runs on every push to `main` and every pull request. The backend job runs ruff, mypy, the migrations, and pytest against a PostgreSQL 16 service container. The frontend job runs eslint, prettier, vitest, and a type-checked production build. The migration step applies every revision to an empty database and then runs `alembic check`, which fails if the models and the migration files have drifted apart. Without it nothing would notice, because the test suite builds its schema straight from the models.

## Known limitations

Because the nature of the program is to be a demo, there is no authentication, although there are plans to add some level of feature limitations based on role.

The container stack is built for a demo rather than a deployment. Credentials default to `westguard/westguard`, Postgres publishes 5432 to the host, and nginx serves plain HTTP with no TLS in front of it.

## License

MIT, see [LICENSE](LICENSE). The license conveys no regulatory clearance for medical use.
