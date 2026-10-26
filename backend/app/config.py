from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    model_path: Path = BACKEND_DIR / "models" / "fruitcheck_model_v3.keras"
    class_names_path: Path = BACKEND_DIR / "models" / "class_names.json"

    max_upload_mb: int = 8
    confidence_threshold: float = 0.70
    predict_timeout_s: float = 20.0

    # Comma-separated origins. Native mobile apps do not send an Origin header,
    # so this only matters for browsers (e.g. Expo web during development).
    cors_origins: str = ""

    # Public (publishable/anon) values only. The service-role key is never used.
    supabase_url: str = ""
    supabase_key: str = ""
    supabase_table: str = "classifications"

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def supabase_enabled(self) -> bool:
        return bool(self.supabase_url and self.supabase_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
