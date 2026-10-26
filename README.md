# FruitCheck

Android app (Expo / React Native / TypeScript) that classifies an apple, banana or mango photo as **ripe** or **unripe**, using the existing `fruitcheck_model.keras` served by a FastAPI backend. Scan history is stored in Supabase (Auth + Postgres with Row Level Security).

```
FruitCheck/
  backend/            FastAPI + Keras inference
    app/              main.py, model_service.py, supabase_client.py, config.py, schemas.py
    models/           fruitcheck_model.keras, class_names.json
    scripts/          evaluate_labels.py (label-order check)
    tests/            pytest suite
  mobile/             Expo app (src/app = screens, src/lib = api/auth/supabase)
  supabase/migrations SQL schema + RLS policies
  ripe unripe fruits/ dataset (6 folders x 400 images)
```

## The model (what was verified)

| Item | Value | How known |
|---|---|---|
| Architecture | MobileNetV2 backbone + GAP + Dropout(0.3) + Dense(6, softmax) | read from the `.keras` config |
| Input | 224×224×3, float, **raw 0–255** | config; the model has its own `Rescaling(1/127.5, -1)` layer, so the backend must not normalise again |
| Output | 6 softmax probabilities | config |
| Class order | `apple_ripe, apple_unripe, banana_ripe, banana_unripe, mango_ripe, mango_unripe` | original training file `classes.json` (saved at the same time as the model), cross-checked on the dataset |

**The class order is not stored in the model file.** `backend/models/class_names.json` is a copy of the training artifact `classes.json` (its timestamp matches the model's save time). It was cross-checked independently: `backend/scripts/evaluate_labels.py` ran the model over all 2,400 dataset images and each folder mapped almost entirely to the same output index as `classes.json`. Alphabetical folder order (Keras' default) would be *wrong* here (33% agreement).

**Accuracy is not independently established.** The script reached about 99% agreement, but those images are very likely the training data, so this is *not* a held-out accuracy estimate. Your Supabase `model_versions` row records test accuracy 0.97778 on 360 samples; that figure comes from your own training run and was not re-measured here. No precision/recall/F1/confusion-matrix on a separate test set, and no leakage/duplicate check, could be done without the original train/test split. Do not quote accuracy figures until that is evaluated. Also note the dataset images are tiny (≈2–7 KB), so real phone photos may behave differently; the confidence threshold and the "uncertain" result exist for that reason.

## 1. Run the backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env      # then fill SUPABASE_URL and SUPABASE_KEY (publishable key)
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```
Check `http://localhost:8000/health` → `"model_loaded": true`. Interactive docs: `/docs`.
If the model or `class_names.json` is missing, the server still starts and `/health` reports `degraded`; `/predict` returns 503.

Run tests: `python -m pytest -q` (23 tests: validation, size/type limits, corrupt images, model loading, class-mapping regression on dataset samples, invalid-token rejection).

### Configuration (`backend/.env`)
`MODEL_PATH`, `CLASS_NAMES_PATH`, `MAX_UPLOAD_MB` (8), `CONFIDENCE_THRESHOLD` (0.70, a tunable heuristic, not a correctness guarantee), `PREDICT_TIMEOUT_S` (20), `CORS_ORIGINS` (comma-separated; native apps don't need it), `SUPABASE_URL`, `SUPABASE_KEY`.

## 2. Supabase setup

1. The schema is `supabase/migrations/20261022000000_fruitcheck_schema.sql` (your `fruitcheck_supabase.sql`), **already applied** to the project: tables `profiles`, `fruit_types`, `model_versions`, `classifications`. Scans are written to `classifications` (`predicted_label` e.g. `apple_ripe`, `fruit_type_id`, `ripeness`, `confidence`, `image_source`, `model_version_id`).
2. **Authentication → Providers → Email** is enabled. For quick testing you may turn off *Confirm email*; otherwise new users must click the emailed link before signing in.
3. Use only the **publishable** key (`sb_publishable_…`) in the app and backend. The service-role key is never needed and must never be put in the mobile app.

Security design: the app signs users in with Supabase Auth. For each scan the app sends its access token to `/predict`; the backend asks Supabase Auth to validate the token (a client-supplied user id is never trusted), then inserts the row **using that user's token**, so RLS enforces `user_id = auth.uid()` (select/insert/delete policies for the owner only). Photos are not stored (`image_path` is unused). As the schema's own note says, RLS still lets a signed-in user insert rows directly; making the backend the only writer would require a server-side service-role key and revoking the direct insert grant.

The REST URL you gave (`…/rest/v1/`) is used by the app indirectly: `EXPO_PUBLIC_SUPABASE_URL` is the project root `https://vexhdhsnghiyapvxdeaf.supabase.co` (supabase-js appends `/rest/v1` itself).

## 3. Run the mobile app on a physical Android phone

```powershell
cd mobile
npm install
copy .env.example .env      # leave EXPO_PUBLIC_API_URL empty for local development
npx expo start
```
1. Install **Expo Go** for **SDK 57** (the project uses Expo SDK 57).
2. Phone and PC on the **same Wi-Fi**, then scan the QR code. If the Wi-Fi is a Windows "Public" network, use `npx expo start --tunnel`.

**How the phone reaches the backend in development:** `mobile/metro.config.js` adds a `/fruitcheck-api/*` proxy to the Expo dev server, forwarding to `http://127.0.0.1:8000` on the PC. The app builds its API URL from the address it was loaded from (`http://<LAN IP>:8081/fruitcheck-api`, or `https://…exp.direct/fruitcheck-api` with `--tunnel`), never `localhost`. So if the app loads, the API is reachable too. To use a deployed backend instead, set `EXPO_PUBLIC_API_URL=https://…`.

### App structure (`mobile/src`)

| Path | Purpose |
|---|---|
| `app/index.tsx` | Branded splash; routes to onboarding, sign-in or Home |
| `app/onboarding.tsx` | 3-step introduction (shown once) |
| `app/(auth)/login, register, forgot-password` | Supabase Auth (email + password, name stored in `profiles` by the DB trigger) |
| `app/(tabs)/home, scan, history, profile` | Bottom tabs. Scan uses `expo-camera` with a positioning guide; gallery uses `expo-image-picker` with type/size checks |
| `app/preview.tsx` → `app/result.tsx` | Preview, then upload + real `/predict` call, loading/error/result states |
| `app/record/[id].tsx` | Saved scan detail with delete |
| `app/about.tsx`, `app/privacy.tsx` | App and privacy information |
| `lib/` | `api` (FastAPI), `history` (Supabase queries, private photo storage), `profile`, `labels` (model label → fruit/ripeness), `theme`, `validation` |
| `components/` | Shared UI (buttons, inputs, cards, badges, confidence bar, scan rows) |

Photos are uploaded to the private `fruit-images` bucket at `<user id>/<file>.jpg` (enforced by storage RLS) and shown with short-lived signed URLs. The backend links the path to the scan only after checking it is inside the caller's own folder. Hero and onboarding images in `assets/fruits` are real photos taken from the project dataset.

Logs: Metro prints `[fruitcheck-api] POST /predict -> 200 (250 ms)`; the app logs `[FruitCheck] …` lines (URL, HTTP status, timing, prediction) in the Metro terminal; the backend logs each request, prediction and history-save result. Tokens and images are never logged.

After editing `.env`, restart with `npx expo start -c`.

## API

| Endpoint | Description |
|---|---|
| `GET /health` | `{status, model_loaded, model_error, supabase_configured}` |
| `GET /model-info` | input size, class names, confidence threshold, upload limit |
| `POST /predict` | multipart field `file` (JPEG/PNG/WebP, ≤ 8 MB), optional fields `image_source` (`camera`/`gallery`) and `image_path` (the caller's own storage key); optional `Authorization: Bearer <supabase access token>` to save to history |

```bash
curl -F "file=@apple.jpg;type=image/jpeg" http://localhost:8000/predict
```
Response (values come from the model; this is one real run on a dataset image):
```json
{"success":true,"predicted_class":"mango_unripe","fruit":"mango","ripeness":"unripe",
 "confidence":0.990,"uncertain":false,"probabilities":{"apple_ripe":0.00006,"…":"…"},
 "message":"Prediction completed. …","timestamp":"2026-10-23T05:11:15Z","saved":false,"scan_id":null}
```
`uncertain: true` is returned when confidence < threshold. Errors: `400` invalid/corrupt/empty image, `401` bad session, `413` too large, `415` wrong type, `422` missing file, `503` model unavailable, `504` timeout. Body: `{"success": false, "detail": "…"}`.

## Troubleshooting

- **"Cannot reach the server at …"**: the URL in the message is the one used. If it is a stale tunnel URL, clear `EXPO_PUBLIC_API_URL` in `mobile/.env` and restart with `npx expo start -c`. If the backend is down, the proxy answers "The FruitCheck backend is not running on the computer".
- **`npx expo start` fails / port 8081 in use**: an old Expo is still running; close it (Ctrl+C) or end the `node.exe` process.
- **Git Bash**: activate scripts don't work there; run `.venv/Scripts/python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000`.
- **Env changes ignored**: restart Expo with `-c`.
- **History says table missing**: run `supabase/migrations/20261022000000_fruitcheck_schema.sql`.
- **Sign-up works but sign-in fails**: confirm the email, or disable *Confirm email* in Supabase.
- **Result says "could not be saved"**: backend `.env` lacks Supabase values, or the session expired.
- **Model not loaded**: check `backend/models/` for both files; the log shows the exact reason. Use the pinned `tensorflow==2.20.0` / `keras==3.13.2` (the model was saved with Keras 3.13.2).
- **Android release build blocks `http://`**: use HTTPS in production (below).

## Production deployment

- Run the backend behind HTTPS (reverse proxy such as Caddy/nginx, or a host with managed TLS) with `uvicorn app.main:app --workers 1` (the TensorFlow model is loaded per worker), and set `EXPO_PUBLIC_API_URL=https://…` before building the app (`eas build`).
- Keep secrets in the host's secret manager / environment, never in git (`.env` is git-ignored). Only publishable keys belong in the app bundle.
- Set `CORS_ORIGINS` only if a browser client exists. Consider rate limiting at the proxy.
- Re-evaluate the model on a held-out test set before relying on its output.

## Status / known limitations

- Verified: model loads and predicts over real HTTP; 14 backend tests pass; mobile app type-checks, lints, passes `expo-doctor`, and bundles for Android; Supabase project reachable and key accepted.
- Verified through the Expo proxy at the LAN IP (the phone's path): health, prediction for all 6 classes, a 4000×3000 camera-style JPEG with EXIF rotation, invalid-session rejection, and the backend-down message.
- **Not verified**: the app running on the phone, and a signed-in scan being saved to `classifications` (no test account was created in your Supabase project).
- Class order is inferred from data (see above); real-world accuracy is unmeasured.
