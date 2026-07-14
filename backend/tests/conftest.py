"""Shared fixtures for database-backed tests.

Tests run against the Postgres pointed to by DATABASE_URL (the docker-compose
db locally, the service container in CI). Each test gets a fresh engine,
schema, and session, all function-scoped so the asyncio event loop, the
engine, and the session share one scope and one loop. NullPool keeps no
connection alive past the test, so nothing leaks across the per-test loop.
"""

from collections.abc import AsyncIterator

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import NullPool
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings
from app.db import Base, get_session
from app.main import app
from app.models import Analyte, QCLot  # noqa: F401  # register mappers on Base


@pytest_asyncio.fixture
async def session() -> AsyncIterator[AsyncSession]:
    engine = create_async_engine(get_settings().database_url, poolclass=NullPool)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session
        await session.rollback()

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def client() -> AsyncIterator[AsyncClient]:
    """An HTTP client bound to the app with the DB dependency overridden.

    Each request gets its own session against a fresh per-test schema, and the
    endpoints commit normally; isolation comes from recreating the schema per
    test rather than from a rollback, so committed API writes stay visible
    across requests within a test.
    """
    engine = create_async_engine(get_settings().database_url, poolclass=NullPool)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(engine, expire_on_commit=False)

    async def override_get_session() -> AsyncIterator[AsyncSession]:
        async with factory() as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as http_client:
        yield http_client
    app.dependency_overrides.clear()

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()
