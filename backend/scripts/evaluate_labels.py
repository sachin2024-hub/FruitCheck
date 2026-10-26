"""Checks the model's output order against the dataset folders.

The model file stores no class names. Keras' image_dataset_from_directory sorts folder
names alphabetically, so that order is the candidate mapping. This script measures how
well each model output index lines up with each folder; a correct mapping shows a clear
diagonal. NOTE: if these images were used for training, the numbers are optimistic and
this is NOT a held-out accuracy estimate.
"""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.model_service import ModelService  # noqa: E402

root = Path(sys.argv[1])
folders = sorted(p.name for p in root.iterdir() if p.is_dir())
svc = ModelService(Path("models/fruitcheck_model.keras"), Path("models/class_names.json"))
import json, keras  # noqa: E402,E401

svc.model = keras.saving.load_model(svc.model_path, compile=False)
svc.class_names = [str(i) for i in range(len(folders))]
n = len(folders)
cm = np.zeros((n, n), dtype=int)
for ti, name in enumerate(folders):
    files = sorted((root / name).glob("*"))
    for f in files:
        if f.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
            continue
        try:
            cm[ti, int(svc.predict(f.read_bytes()).label)] += 1
        except Exception as exc:  # noqa: BLE001
            print("skip", f.name, exc)
print("rows = folder (true), cols = model output index")
print("folders:", folders)
print(cm)
print("accuracy under alphabetical mapping:", np.trace(cm) / cm.sum())
