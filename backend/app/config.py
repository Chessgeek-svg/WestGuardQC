from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment variables.

    Defaults target local development against the docker-compose stack.
    """

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+asyncpg://westguard:westguard@localhost:5432/westguardqc"


@lru_cache
def get_settings() -> Settings:
    return Settings()
