"""Pydantic settings for the LSTM forecast service."""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class LstmServiceSettings(BaseSettings):
    """LSTM service configuration loaded from environment variables / .env."""

    # --- Database -------------------------------------------------------
    database_url: str = Field(
        default="postgresql+asyncpg://postgres:12345@localhost:5432/SteelTrackDb",
        alias="DATABASE_URL",
        description="PostgreSQL async connection string (asyncpg driver)",
    )

    # --- Model storage --------------------------------------------------
    model_dir: str = Field(
        default="./models",
        alias="MODEL_DIR",
        description="Path where model artifacts are saved",
    )

    # --- API ------------------------------------------------------------
    api_key: str = Field(
        default="dev-api-key-change-me",
        alias="LSTM_API_KEY",
        description="Shared secret sent by .NET in the X-LSTM-API-KEY header",
    )

    # --- LSTM defaults --------------------------------------------------
    lookback_months: int = Field(
        default=24, alias="LSTM_LOOKBACK_MONTHS", ge=6, le=60,
        description="Number of past months used as the input sequence",
    )
    horizon_months: int = Field(
        default=3, alias="LSTM_HORIZON_MONTHS", ge=1, le=12,
        description="Number of future months to predict",
    )
    batch_size: int = Field(
        default=32, alias="LSTM_BATCH_SIZE", ge=1,
        description="Training batch size (number of series per step)",
    )
    max_epochs: int = Field(
        default=50, alias="LSTM_MAX_EPOCHS", ge=1,
        description="Hard cap on training epochs (early stopping usually ends sooner)",
    )
    learning_rate: float = Field(
        default=1e-3, alias="LSTM_LEARNING_RATE",
        description="AdamW learning rate for the LSTM optimizer",
    )
    min_history_months: int = Field(
        default=2, alias="LSTM_MIN_HISTORY_MONTHS", ge=1,
        description="Minimum history required to train a per-series model; "
                    "series below this fall back to seasonal-naive",
    )

    # --- Monitoring -----------------------------------------------------
    metrics_port: int = Field(
        default=9090, alias="LSTM_METRICS_PORT", ge=1, le=65535,
        description="Prometheus exporter port",
    )
    log_level: str = Field(
        default="INFO", alias="LOG_LEVEL",
        description="Python logging level",
    )

    # --- Scheduling -----------------------------------------------------
    nightly_retrain_hour: int = Field(
        default=2, alias="LSTM_RETRAIN_HOUR", ge=0, le=23,
        description="Local hour at which the nightly retraining job fires",
    )
    enable_scheduler: bool = Field(
        default=True, alias="LSTM_ENABLE_SCHEDULER",
        description="Set false in tests/CI to avoid background jobs",
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        populate_by_name=True,
        extra="ignore",
    )


@lru_cache(maxsize=1)
def get_settings() -> LstmServiceSettings:
    """Return a cached Settings instance."""
    return LstmServiceSettings()


# Backwards-compatible alias used across the codebase.
load_settings = get_settings
