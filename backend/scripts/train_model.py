"""Trains a MobileNetV2 classifier on the leak-free split from audit_dataset.py.

    python scripts/audit_dataset.py "../ripe unripe fruits" --split models/split.json
    python scripts/train_model.py "../ripe unripe fruits" models/split.json models/fruitcheck_model_v2.keras

The saved model takes raw 0-255 RGB (224x224) and scales to [-1, 1] itself, exactly like the model the
API already serves, and uses the output order in models/class_names.json. Augmentation runs only in the
training pipeline. Hue/saturation jitter is kept small on purpose: colour must not be the only cue.
"""
import json
import sys
from pathlib import Path

import keras
import numpy as np
import tensorflow as tf
from keras import layers

root, manifest, out = Path(sys.argv[1]), json.loads(Path(sys.argv[2]).read_text()), sys.argv[3]
names = json.loads(Path("models/class_names.json").read_text())
SIZE, BATCH = (224, 224), 32
keras.utils.set_random_seed(7)


def label_of(folder: str) -> int:
    ripeness, fruit = folder.split(" ", 1)
    return names.index(f"{fruit}_{ripeness}")


def files(part):
    paths, labels = [], []
    for rel in manifest[part]:
        folder, name = rel.split("/", 1)
        paths.append(str(root / folder / name))
        labels.append(label_of(folder))
    return paths, np.array(labels)


def load(path, label):
    img = tf.io.decode_image(tf.io.read_file(path), channels=3, expand_animations=False)
    img = tf.image.resize(img, SIZE, method="bilinear")
    img.set_shape((*SIZE, 3))
    return img, label


augment = keras.Sequential(
    [
        layers.RandomFlip("horizontal"),
        layers.RandomRotation(0.08, fill_mode="reflect"),
        layers.RandomZoom((-0.3, 0.1), fill_mode="reflect"),
        layers.RandomTranslation(0.1, 0.1, fill_mode="reflect"),
        layers.RandomBrightness(0.25, value_range=(0, 255)),
        layers.RandomContrast(0.25),
    ]
)


def jitter(img, label):
    img = augment(img, training=True)
    img = tf.image.random_hue(img / 255.0, 0.03)
    img = tf.image.random_saturation(img, 0.7, 1.3) * 255.0
    return tf.clip_by_value(img, 0, 255), label


def dataset(part, train):
    p, y = files(part)
    ds = tf.data.Dataset.from_tensor_slices((p, y))
    if train:
        ds = ds.shuffle(len(p), seed=7)
    ds = ds.map(load, num_parallel_calls=tf.data.AUTOTUNE)
    if train:
        ds = ds.map(jitter, num_parallel_calls=tf.data.AUTOTUNE)
    return ds.batch(BATCH).prefetch(tf.data.AUTOTUNE), y


train, ytrain = dataset("train", True)
val, _ = dataset("val", False)
test, ytest = dataset("test", False)
counts = np.bincount(ytrain, minlength=len(names))
weights = {i: float(len(ytrain) / (len(names) * c)) for i, c in enumerate(counts)}
print("train per class:", dict(zip(names, counts.tolist())), "val:", len(manifest["val"]), "test:", len(ytest))

base = keras.applications.MobileNetV2(input_shape=(*SIZE, 3), include_top=False, weights="imagenet")
base.trainable = False
inputs = keras.Input((*SIZE, 3))
x = layers.Rescaling(1 / 127.5, offset=-1)(inputs)
x = base(x, training=False)
x = layers.GlobalAveragePooling2D()(x)
x = layers.Dropout(0.4)(x)
model = keras.Model(inputs, layers.Dense(len(names), activation="softmax")(x))
loss = keras.losses.SparseCategoricalCrossentropy()  # no label smoothing: keeps scores interpretable
stop = keras.callbacks.EarlyStopping(monitor="val_loss", patience=4, restore_best_weights=True)

model.compile(keras.optimizers.Adam(1e-3), loss, metrics=["accuracy"])
model.fit(train, validation_data=val, epochs=12, class_weight=weights, callbacks=[stop])

base.trainable = True
for layer in base.layers[:-40]:
    layer.trainable = False
model.compile(keras.optimizers.Adam(1e-5), loss, metrics=["accuracy"])
model.fit(train, validation_data=val, epochs=12, class_weight=weights, callbacks=[stop])

model.save(out)
print("saved", out)
print("held-out test loss/accuracy:", model.evaluate(test, verbose=0))
