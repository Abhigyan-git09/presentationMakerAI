from __future__ import annotations

from functools import lru_cache

from pydantic import AnyHttpUrl, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    ai_service_url: AnyHttpUrl
    document_service_url: AnyHttpUrl
    database_url: str = Field(min_length=1)
    port: int = Field(default=8081, ge=1, le=65535)
    upstream_timeout_seconds: float = Field(default=60.0, gt=0)
    database_echo: bool = False

    @property
    def ai_service_base_url(self) -> str:
        return str(self.ai_service_url).rstrip("/")

    @property
    def document_service_base_url(self) -> str:
        return str(self.document_service_url).rstrip("/")


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
