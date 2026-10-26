from datetime import datetime

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    model_error: str | None = None
    supabase_configured: bool


class ModelInfoResponse(BaseModel):
    model_loaded: bool
    input_height: int | None = None
    input_width: int | None = None
    input_channels: int = 3
    class_names: list[str] = []
    confidence_threshold: float
    max_upload_mb: int


class PredictResponse(BaseModel):
    success: bool
    predicted_class: str | None = Field(None, description="Top-1 class from the model.")
    fruit: str | None = None
    ripeness: str | None = None
    confidence: float = Field(..., ge=0, le=1, description="Model softmax score, not a guarantee of correctness.")
    uncertain: bool
    probabilities: dict[str, float]
    message: str
    warnings: list[str] = Field([], description="Photo-quality warnings (dim, glare, blurry).")
    timestamp: datetime
    saved: bool = False
    scan_id: str | None = None
    save_error: str | None = Field(None, description="Why the scan was not saved to history, if it was not.")
