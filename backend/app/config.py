from functools import lru_cache
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "ClinicFlow API"
    environment: Literal["development", "test", "production"] = "development"

    # Local development defaults
    database_url: str = "sqlite:///./clinicflow.db"
    jwt_secret: str = "development-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 480

    cors_origins: str = (
        "http://localhost:3000,"
        "http://127.0.0.1:3000"
    )

    # Local development only.
    # Production uploads must use Blob/S3-compatible storage.
    private_upload_dir: str = "./private_uploads"
    max_upload_bytes: int = 10_485_760

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    @property
    def cors_list(self) -> list[str]:
        return [
            item.strip().rstrip("/")
            for item in self.cors_origins.split(",")
            if item.strip()
        ]

    @model_validator(mode="after")
    def validate_production_settings(self) -> "Settings":
        if self.environment == "production":
            if self.database_url.startswith("sqlite"):
                raise ValueError(
                    "DATABASE_URL must use PostgreSQL in production."
                )

            if self.jwt_secret == "development-secret-change-me":
                raise ValueError(
                    "JWT_SECRET must be changed in production."
                )

        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()