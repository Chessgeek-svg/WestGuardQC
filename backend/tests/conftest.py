"""Shared fixtures for database-backed tests.

Tests run against the Postgres pointed to by DATABASE_URL (the docker-compose
db locally, the service container in CI). Each test gets a fresh engine,
schema, and session, all function-scoped so the asyncio event loop, the
engine, and the session share one scope and one loop. NullPool keeps no
connection alive past the test, so nothing leaks across the per-test loop.
"""

from collections.abc import AsyncIterator

import pytest_asyncio
from sqlalchemy import NullPool
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings
from app.db import Base
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
