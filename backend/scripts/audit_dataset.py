"""Audits the training folders (one folder per class, e.g. "ripe mango") and, with --split, writes a
leak-free train/val/test manifest.

Reports per-class counts, file types, image sizes, exact duplicates and near-duplicates (64-bit difference
hash). Near-duplicate images are grouped and kept in the SAME split, so a test image never has a
look-alike in the training set. Usage:
    python scripts/audit_dataset.py "../ripe unripe fruits" [--split split.json]
"""
import collections
import hashlib
import json
import random
import sys
from pathlib import Path

import numpy as np
from PIL import Image

EXTS = {".jpg", ".jpeg", ".png", ".webp"}


def dhash(path: Path) -> int:
    with Image.open(path) as im:
        px = np.asarray(im.convert("L").resize((9, 8), Image.BILINEAR), dtype="int16")
    bits = (px[:, 1:] > px[:, :-1]).flatten()
    return int("".join("1" if b else "0" for b in bits), 2)


def main() -> None:
    root = Path(sys.argv[1])
    out = sys.argv[sys.argv.index("--split") + 1] if "--split" in sys.argv else None
    classes = sorted(p for p in root.iterdir() if p.is_dir())
    items: list[tuple[str, Path, str, int]] = []  # class, path, md5, dhash
    for d in classes:
        sizes, skipped = [], 0
        for f in sorted(d.iterdir()):
            if f.suffix.lower() not in EXTS:
                skipped += 1
                continue
            with Image.open(f) as im:
                sizes.append(min(im.size))
            items.append((d.name, f, hashlib.md5(f.read_bytes()).hexdigest(), dhash(f)))
        s = np.array(sizes)
        print(f"{d.name:14} images={len(s):4}  unsupported_files={skipped}  min-side px: median={int(np.median(s))} "
              f"p10={int(np.percentile(s, 10))} min={s.min()}")

    exact = collections.defaultdict(list)
    for c, f, md5, _ in items:
        exact[md5].append((c, f))
    ex = [v for v in exact.values() if len(v) > 1]
    print(f"\nexact duplicate groups: {len(ex)} (cross-class: {sum(len({c for c, _ in v}) > 1 for v in ex)})")

    # Union images whose difference hashes are within 6 bits (near-identical pictures).
    parent = list(range(len(items)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    hashes = np.array([[(h >> b) & 1 for b in range(64)] for *_, h in items], dtype=np.uint8)
    for i in range(len(items)):
        close = np.where((hashes[i + 1:] != hashes[i]).sum(1) <= 6)[0] + i + 1
        for j in close:
            parent[find(j)] = find(i)
    groups = collections.defaultdict(list)
    for i in range(len(items)):
        groups[find(i)].append(i)
    multi = [g for g in groups.values() if len(g) > 1]
    cross = sum(len({items[i][0] for i in g}) > 1 for g in multi)
    print(f"near-duplicate groups: {len(multi)} covering {sum(map(len, multi))} images (cross-class: {cross})")
    print(f"independent pictures after grouping: {len(groups)} of {len(items)}")
    per = collections.Counter(items[g[0]][0] for g in groups.values())
    print("independent pictures per class:", dict(per))

    if out:
        rng = random.Random(7)
        split = {"train": [], "val": [], "test": []}
        by_class = collections.defaultdict(list)
        for g in groups.values():
            by_class[items[g[0]][0]].append(g)
        for c, gs in by_class.items():
            rng.shuffle(gs)
            n = len(gs)
            for k, g in enumerate(gs):
                name = "train" if k < 0.7 * n else "val" if k < 0.85 * n else "test"
                split[name] += [f"{items[i][0]}/{items[i][1].name}" for i in g]
        Path(out).write_text(json.dumps(split, indent=1))
        print("wrote", out, {k: len(v) for k, v in split.items()})


if __name__ == "__main__":
    main()
