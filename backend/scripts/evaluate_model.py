"""Real evaluation: confusion matrix, per-class precision/recall and overall accuracy on a folder of
labelled images that the model was NOT trained on.

Folders are named like the dataset ("ripe mango"); they are mapped to the model's labels
("mango_ripe") and the model's output order comes from models/class_names.json, so nothing is
assumed about alphabetical order. Usage:
    python scripts/evaluate_model.py <test-root> [--manifest split.json --part test] [--limit N]
"""
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.model_service import ModelService  # noqa: E402


def label_of(folder: str) -> str:
    ripeness, fruit = folder.split(" ", 1)
    return f"{fruit}_{ripeness}"


def arg(name, default=None):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default


root = Path(sys.argv[1])
limit = int(arg("--limit", 0)) or None
allowed = None
if arg("--manifest"):
    allowed = set(json.loads(Path(arg("--manifest")).read_text())[arg("--part", "test")])

svc = ModelService(Path(arg("--model", "models/fruitcheck_model.keras")), Path("models/class_names.json"))
svc.load()
if not svc.loaded:
    sys.exit(svc.error)
names = svc.class_names
cm = np.zeros((len(names), len(names)), dtype=int)
for d in sorted(p for p in root.iterdir() if p.is_dir()):
    true = names.index(label_of(d.name))
    files = [f for f in sorted(d.iterdir()) if f.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}]
    if allowed is not None:
        files = [f for f in files if f"{d.name}/{f.name}" in allowed]
    for f in files[:limit]:
        cm[true, names.index(svc.predict(f.read_bytes()).label)] += 1

print("rows = true, cols = predicted;", names)
print(cm)
tp = np.diag(cm)
for i, n in enumerate(names):
    p = tp[i] / cm[:, i].sum() if cm[:, i].sum() else float("nan")
    r = tp[i] / cm[i].sum() if cm[i].sum() else float("nan")
    print(f"{n:14} precision={p:.3f} recall={r:.3f} n={cm[i].sum()}")
print(f"overall accuracy: {tp.sum() / cm.sum():.3f} on {cm.sum()} images")
