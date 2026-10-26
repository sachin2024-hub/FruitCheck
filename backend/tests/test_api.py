import io
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.main import app, is_own_image_path

DATASET = Path(__file__).resolve().parents[2] / "ripe unripe fruits"


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def png_bytes(size=(64, 64), color=(200, 30, 30)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, format="PNG")
    return buf.getvalue()


def test_health_reports_model_loaded(client):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["model_loaded"] is True
    assert body["status"] == "ok"


def test_model_info(client):
    body = client.get("/model-info").json()
    assert (body["input_height"], body["input_width"]) == (224, 224)
    assert len(body["class_names"]) == 6


def test_predict_valid_image_shape(client):
    r = client.post("/predict", files={"file": ("a.png", png_bytes(), "image/png")})
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert body["predicted_class"] in client.get("/model-info").json()["class_names"]
    assert 0 <= body["confidence"] <= 1
    assert abs(sum(body["probabilities"].values()) - 1) < 1e-3
    assert body["saved"] is False  # no auth header -> nothing stored
    assert body["save_error"]  # and the response says why


def test_predict_rejects_wrong_type(client):
    r = client.post("/predict", files={"file": ("a.txt", b"hello", "text/plain")})
    assert r.status_code == 415


def test_predict_rejects_corrupt_image(client):
    r = client.post("/predict", files={"file": ("a.jpg", b"\xff\xd8\xff" + b"garbage" * 10, "image/jpeg")})
    assert r.status_code == 400


def test_predict_rejects_wrong_signature(client):
    r = client.post("/predict", files={"file": ("a.jpg", b"not an image at all", "image/jpeg")})
    assert r.status_code == 400


def test_predict_rejects_empty(client):
    r = client.post("/predict", files={"file": ("a.png", b"", "image/png")})
    assert r.status_code == 400


def test_predict_rejects_oversize(client):
    big = png_bytes() + b"\0" * (9 * 1024 * 1024)
    r = client.post("/predict", files={"file": ("a.png", big, "image/png")})
    assert r.status_code == 413


def test_predict_missing_file(client):
    assert client.post("/predict").status_code == 422


def test_invalid_token_is_rejected_when_supabase_configured(client):
    if not client.get("/health").json()["supabase_configured"]:
        pytest.skip("Supabase not configured")
    r = client.post(
        "/predict",
        files={"file": ("a.png", png_bytes(), "image/png")},
        headers={"Authorization": "Bearer not-a-real-token"},
    )
    assert r.status_code == 401


@pytest.mark.parametrize(
    "path,ok",
    [
        ("u1/1729-abc.jpg", True),
        ("u2/1729-abc.jpg", False),  # another user's folder
        ("u1/../u2/x.jpg", False),
        ("u1/sub/x.jpg", False),
        ("u1/x.exe", False),
        ("x.jpg", False),
    ],
)
def test_image_path_must_be_in_own_folder(path, ok):
    assert is_own_image_path("u1", path) is ok


def test_predict_rejects_bad_image_source(client):
    r = client.post(
        "/predict", files={"file": ("a.png", png_bytes(), "image/png")}, data={"image_source": "webcam"}
    )
    assert r.status_code == 422


@pytest.mark.skipif(not DATASET.is_dir(), reason="dataset not present")
@pytest.mark.parametrize(
    "folder,label,fruit,ripeness",
    [
        ("ripe apple", "apple_ripe", "apple", "ripe"),
        ("unripe apple", "apple_unripe", "apple", "unripe"),
        ("ripe banana", "banana_ripe", "banana", "ripe"),
        ("unripe banana", "banana_unripe", "banana", "unripe"),
        ("ripe mango", "mango_ripe", "mango", "ripe"),
        ("unripe mango", "mango_unripe", "mango", "unripe"),
    ],
)
def test_class_mapping_on_dataset_samples(client, folder, label, fruit, ripeness):
    """Regression guard for the output-index -> label mapping in class_names.json."""
    files = sorted((DATASET / folder).glob("*.jpg"))[:10]
    hits = 0
    for f in files:
        body = client.post(
            "/predict", files={"file": (f.name, f.read_bytes(), "image/jpeg")}, data={"image_source": "camera"}
        ).json()
        if body["predicted_class"] == label:
            hits += 1
            assert (body["fruit"], body["ripeness"]) == (fruit, ripeness)
    # A mapping bug would score ~0-2 of 10; a few misses are normal for a model evaluated on raw samples.
    assert hits >= 6
