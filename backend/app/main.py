import asyncio
import logging
import re
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Literal

from fastapi import FastAPI, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .model_service import ImageTooDarkError, InvalidImageError, ModelLoadError, ModelService, assess_quality
from .schemas import HealthResponse, ModelInfoResponse, PredictResponse
from .supabase_client import SupabaseClient

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("fruitcheck.api")

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
# Storage key format required by the fruit-images bucket policy: <user id>/<file name>
_IMAGE_NAME = re.compile(r"^[A-Za-z0-9._-]{1,120}\.(jpg|jpeg|png|webp)$")


def is_own_image_path(user_id: str, path: str) -> bool:
    folder, sep, name = path.partition("/")
    return bool(sep) and folder == user_id and bool(_IMAGE_NAME.match(name))
# Magic bytes: the client-supplied content-type is not trusted on its own.
SIGNATURES = (b"\xff\xd8\xff", b"\x89PNG\r\n\x1a\n", b"RIFF")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    service = ModelService(settings.model_path, settings.class_names_path)
    service.load()  # failure is recorded and reported by /health; server still starts
    app.state.model = service
    app.state.infer_lock = asyncio.Semaphore(1)
    app.state.supabase = (
        SupabaseClient(settings.supabase_url, settings.supabase_key, settings.supabase_table)
        if settings.supabase_enabled
        else None
    )
    yield


app = FastAPI(title="FruitCheck API", version="1.0.0", lifespan=lifespan)

_origins = get_settings().cors_origin_list
if _origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_origins,
        allow_methods=["GET", "POST"],
        allow_headers=["Authorization", "Content-Type"],
    )


@app.middleware("http")
async def log_requests(request: Request, call_next):
    # Method, path, status and timing only: no headers (tokens) or bodies (images).
    start = time.perf_counter()
    response = await call_next(request)
    client = request.client.host if request.client else "-"
    logger.info(
        "%s %s -> %s (%.0f ms) from %s",
        request.method,
        request.url.path,
        response.status_code,
        (time.perf_counter() - start) * 1000,
        client,
    )
    return response


@app.exception_handler(HTTPException)
async def http_error(request: Request, exc: HTTPException):
    if exc.status_code >= 400:
        logger.warning("%s %s rejected: %s %s", request.method, request.url.path, exc.status_code, exc.detail)
    return JSONResponse(status_code=exc.status_code, content={"success": False, "detail": exc.detail})


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"success": False, "detail": "Invalid request. Send the image as multipart field 'file'."},
    )


@app.exception_handler(Exception)
async def unhandled(_: Request, exc: Exception):
    logger.exception("Unhandled error")
    return JSONResponse(status_code=500, content={"success": False, "detail": "Internal server error."})


@app.get("/health", response_model=HealthResponse)
def health(request: Request):
    service: ModelService = request.app.state.model
    return HealthResponse(
        status="ok" if service.loaded else "degraded",
        model_loaded=service.loaded,
        model_error=None if service.loaded else "Model unavailable; see server logs.",
        supabase_configured=request.app.state.supabase is not None,
    )


@app.get("/model-info", response_model=ModelInfoResponse)
def model_info(request: Request):
    service: ModelService = request.app.state.model
    s = get_settings()
    return ModelInfoResponse(
        model_loaded=service.loaded,
        input_height=service.input_size[0] if service.loaded else None,
        input_width=service.input_size[1] if service.loaded else None,
        class_names=service.class_names,
        confidence_threshold=s.confidence_threshold,
        max_upload_mb=s.max_upload_mb,
    )


@app.post("/predict", response_model=PredictResponse)
async def predict(
    request: Request,
    file: UploadFile = File(...),
    image_source: Literal["camera", "gallery"] = Form("gallery"),
    image_path: str | None = Form(None),
    authorization: str | None = Header(None),
):
    settings = get_settings()
    service: ModelService = request.app.state.model
    if not service.loaded:
        raise HTTPException(503, "The classification model is not available on the server.")

    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(415, "Unsupported file type. Use a JPEG, PNG or WebP image.")
    data = await file.read(settings.max_upload_bytes + 1)
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(413, f"Image is larger than {settings.max_upload_mb} MB.")
    if not data:
        raise HTTPException(400, "The uploaded file is empty.")
    if not data.startswith(SIGNATURES):
        raise HTTPException(400, "The file is not a valid image.")

    try:
        warnings = assess_quality(data)
    except ImageTooDarkError as exc:
        raise HTTPException(422, str(exc))
    except InvalidImageError as exc:
        raise HTTPException(400, str(exc))

    try:
        async with request.app.state.infer_lock:
            result = await asyncio.wait_for(asyncio.to_thread(service.predict, data), settings.predict_timeout_s)
    except InvalidImageError as exc:
        raise HTTPException(400, str(exc))
    except asyncio.TimeoutError:
        raise HTTPException(504, "Prediction timed out. Please try again.")
    except ModelLoadError:
        raise HTTPException(503, "The classification model is not available on the server.")
    except Exception:  # noqa: BLE001
        logger.exception("Inference failed")
        raise HTTPException(500, "Prediction failed.")

    uncertain = result.confidence < settings.confidence_threshold
    # Training labels look like "apple_ripe" (see models/class_names.json).
    fruit, _, ripeness = result.label.rpartition("_")
    logger.info(
        "Prediction %s conf=%.4f uncertain=%s (%d bytes, %s, %s)",
        result.label,
        result.confidence,
        uncertain,
        len(data),
        file.content_type,
        image_source,
    )
    message = (
        "The model is not confident about this image. Retake the photo in good light with the fruit centred."
        if uncertain
        else "Prediction completed. Confidence is the model's score and does not guarantee the result is correct."
    )

    saved, scan_id, save_error = False, None, None
    sb: SupabaseClient | None = request.app.state.supabase
    if sb is None:
        save_error = "the server is not connected to Supabase (SUPABASE_URL/SUPABASE_KEY missing)"
    elif not (authorization and authorization.lower().startswith("bearer ")):
        save_error = "the request was not signed in"
    else:
        token = authorization[7:].strip()
        user_id = await sb.get_user_id(token)
        if user_id is None:
            raise HTTPException(401, "Your session is invalid or expired. Please sign in again.")
        if image_path is not None and not is_own_image_path(user_id, image_path):
            # Only link photos stored in the caller's own private folder.
            logger.warning("Ignoring image_path outside the user's folder")
            image_path = None
        if fruit and ripeness in ("ripe", "unripe"):
            scan_id, save_error = await sb.insert_scan(
                token, user_id, result.label, fruit, ripeness, result.confidence, image_source, image_path
            )
        else:
            save_error = f"label '{result.label}' is not in fruit_ripeness format"
        saved = scan_id is not None
        logger.info("History save: %s", "ok" if saved else f"failed ({save_error})")

    return PredictResponse(
        success=True,
        predicted_class=result.label,
        fruit=fruit or None,
        ripeness=ripeness or None,
        confidence=result.confidence,
        uncertain=uncertain,
        probabilities=result.probabilities,
        message=message,
        warnings=warnings,
        timestamp=datetime.now(timezone.utc),
        saved=saved,
        scan_id=scan_id,
        save_error=save_error,
    )
