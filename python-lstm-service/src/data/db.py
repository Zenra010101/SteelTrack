"""Async SQLAlchemy engine and session factory for the LSTM service.

Uses asyncpg as the PostgreSQL driver so the service can serve requests
while training runs happen in background threads without blocking.
"""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from src.config import load_settings

_engine = create_async_engine(
    load_settings().database_url,
    echo=False,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
)

# Async session factory bound to the engine
_AsyncSessionLocal = async_sessionmaker(
    bind=_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


@asynccontextmanager
async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Context manager that yields a new async session."""
    async with _AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


def close_engine() -> None:
    """Close the engine connection pool on shutdown."""
    _engine.dispose()