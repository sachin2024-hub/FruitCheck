"""Loads fruitcheck_model.keras once and runs inference with the preprocessing
the model was built for.

The saved model contains its own `Rescaling(1/127.5, offset=-1)` layer (the
MobileNetV2 [-1, 1] scaling), so raw 0-255 pixel values must be fed in. Scaling
the image here as well would apply the normalisation twice.
"""
import io
import json
import logging
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError

logger = logging.getLogger("fruitcheck.model")


class ModelLoadError(RuntimeError):
    pass


class InvalidImageError(ValueError):
    pass


@dataclass
class Prediction:
    label: str
    confidence: float
    probabilities: dict[str, float]


class ImageTooDarkError(InvalidImageError):
    pass


# Photo-quality heuristics (not fruit detection: the model has no "not a fruit" class).
# Mean luminance is 0-255; sharpness is the variance of a Laplacian on a <=256px grayscale copy.
REJECT_BELOW_BRIGHTNESS = 20
DIM_BELOW_BRIGHTNESS = 60
GLARE_ABOVE_BRIGHTNESS = 235
BLURRY_BELOW_SHARPNESS = 40.0


def assess_quality(data: bytes) -> list[str]:
    """Returns user-facing warnings about the photo. Raises ImageTooDarkError for unusable photos."""
    try:
        with Image.open(io.BytesIO(data)) as img:
            img.load()
            gray = ImageOps.exif_transpose(img).convert("L")
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as exc:
        raise InvalidImageError("The file is not a valid or readable image.") from exc
    gray.thumbnail((256, 256))
    px = np.asarray(gray, dtype="float32")
    brightness = float(px.mean())
    if brightness < REJECT_BELOW_BRIGHTNESS:
        raise ImageTooDarkError("The photo is too dark to classify. Turn on the flash or move to better light.")
    warnings: list[str] = []
    if brightness < DIM_BELOW_BRIGHTNESS:
        warnings.append("The photo is dim. Use better light or the flash for a more reliable result.")
    elif brightness > GLARE_ABOVE_BRIGHTNESS:
        warnings.append("The photo is very bright. Avoid glare or direct light on the fruit.")
    if px.shape[0] >= 3 and px.shape[1] >= 3:
        lap = px[1:-1, :-2] + px[1:-1, 2:] + px[:-2, 1:-1] + px[2:, 1:-1] - 4 * px[1:-1, 1:-1]
        if float(lap.var()) < BLURRY_BELOW_SHARPNESS:
            warnings.append("The photo may be blurry. Hold the phone steady and tap to focus on the fruit.")
    return warnings


class ModelService:
    def __init__(self, model_path: Path, class_names_path: Path):
        self.model_path = model_path
        self.class_names_path = class_names_path
        self.model = None
        self.class_names: list[str] = []
        self.input_size: tuple[int, int] = (224, 224)  # (height, width)
        self.error: str | None = None

    @property
    def loaded(self) -> bool:
        return self.model is not None

    def load(self) -> None:
        try:
            self._load()
            self.error = None
        except ModelLoadError as exc:
            self.model = None
            self.error = str(exc)
            logger.error("Model not loaded: %s", exc)

    def _load(self) -> None:
        if not self.model_path.is_file():
            raise ModelLoadError(
                f"Model file not found at '{self.model_path}'. Place fruitcheck_model.keras "
                "there or set MODEL_PATH."
            )
        if not self.class_names_path.is_file():
            raise ModelLoadError(
                f"Class label file not found at '{self.class_names_path}'. It must be a JSON "
                "list of class names in the model's output order."
            )
        try:
            class_names = json.loads(self.class_names_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise ModelLoadError(f"Class label file is not valid JSON: {exc}") from exc
        if not (isinstance(class_names, list) and all(isinstance(c, str) for c in class_names)):
            raise ModelLoadError("Class label file must be a JSON list of strings.")

        try:
            import keras

            model = keras.saving.load_model(self.model_path, compile=False)
        except Exception as exc:  # noqa: BLE001 - surface any loader failure clearly
            raise ModelLoadError(f"Could not load model: {type(exc).__name__}: {exc}") from exc

        in_shape = model.input_shape
        out_shape = model.output_shape
        if len(in_shape) != 4 or in_shape[3] != 3 or not in_shape[1] or not in_shape[2]:
            raise ModelLoadError(f"Unsupported model input shape {in_shape}; expected (None, H, W, 3).")
        if len(out_shape) != 2 or out_shape[1] != len(class_names):
            raise ModelLoadError(
                f"Model outputs {out_shape[-1]} classes but the label file lists {len(class_names)}."
            )

        self.model = model
        self.class_names = class_names
        self.input_size = (int(in_shape[1]), int(in_shape[2]))
        # Warm-up so the first real request is not slow.
        model(np.zeros((1, *self.input_size, 3), dtype="float32"), training=False)
        logger.info("Model loaded: input=%s classes=%d", in_shape, len(class_names))

    def preprocess(self, data: bytes) -> np.ndarray:
        try:
            with Image.open(io.BytesIO(data)) as img:
                img.load()
                img = ImageOps.exif_transpose(img)
                if img.mode in ("RGBA", "LA", "P"):
                    img = img.convert("RGBA")
                    background = Image.new("RGBA", img.size, (255, 255, 255, 255))
                    img = Image.alpha_composite(background, img)
                img = img.convert("RGB")
                h, w = self.input_size
                # Bilinear matches tf.keras image_dataset_from_directory's default resize.
                img = img.resize((w, h), Image.BILINEAR)
                arr = np.asarray(img, dtype="float32")
        except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as exc:
            raise InvalidImageError("The file is not a valid or readable image.") from exc
        return arr[None, ...]

    def predict(self, data: bytes) -> Prediction:
        if not self.loaded:
            raise ModelLoadError(self.error or "Model is not loaded.")
        batch = self.preprocess(data)
        probs = np.asarray(self.model(batch, training=False))[0]
        idx = int(np.argmax(probs))
        return Prediction(
            label=self.class_names[idx],
            confidence=float(probs[idx]),
            probabilities={n: float(p) for n, p in zip(self.class_names, probs)},
        )
