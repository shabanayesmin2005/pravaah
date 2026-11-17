# PRAVAAH AI Engine (ai-engine/)

AI-powered vehicle detection, license plate detection, and EasyOCR pipeline, alongside a deterministic synthetic event generator for Smart India Hackathon 2026 (Problem Statement 26127).

---

## Architecture Overview

```
[Camera Source (Video / Image Loop)]
        │
        ▼
[Vehicle Detector / Tracker]  ─── YOLOv8n (COCO) + ByteTrack
        │
        ├── Video mode (CityFlow) ───► Plates unreadable; skips OCR
        │                              (plate_text="", plate_confidence=0.0)
        │
        └── Image mode (Indian Plates)
                │
                ▼
        [Plate Detector]  ─────── yasirfaizahmed/license-plate-object-detection
                │                 (or heuristic bottom-crop if --allow-heuristic-fallback)
                ▼
        [EasyOCR Engine]  ─────── Preprocessing (Upscale, CLAHE, Denoise) + EasyOCR
                │
                ▼
        [Snapshot Manager] ────── Saves crop to backend/public/snapshots/<camera>/
                │
                ▼
        [Schema Validator] ────── Validates vs shared/schemas/detection.schema.json
                │
                ▼
        [Kafka Publisher]  ────── Emits to topic "detections" (or stdout in --dry-run)
```

---

## 1. Environment Setup

Ensure the `pravaah` conda environment is active (Python 3.11 on macOS CPU):

```bash
conda activate pravaah
pip install -r ai-engine/requirements.txt
```

Environment variables are loaded from the root `.env` (copy from `.env.example` if needed).

---

## 2. Part 1 — Camera Worker (`src/main.py`)

The camera worker processes camera feeds mapped in `ai-engine/camera_source_map.json`.

### Features & Design
1. **Single Camera by Default**: Runs one camera per process to keep CPU usage low.
2. **Video Mode (CityFlow)**:
   - Processes every $N$-th frame (`--frame-skip N`, default $N=5$, reducing CPU by 80%).
   - Tracking is performed with ByteTrack.
   - **CityFlow Plate Rule**: Since plates in CityFlow are unreadable, plate detection and OCR are skipped entirely. Emits `plate_text = ""` and `plate_confidence = 0.0` with no detector method set.
3. **Image Mode (Indian Plates)**:
   - Loops images sequentially at configurable FPS (`--fps 2.0`).
   - Runs `VehicleDetector` -> `PlateDetector` -> `OcrEngine`.
   - **Plate Detector Policy**: Loads `yasirfaizahmed/license-plate-object-detection` (HuggingFace Hub) via `YOLO.from_pretrained(...)`. If loading fails, the worker **exits with code 1** unless `--allow-heuristic-fallback` is explicitly provided.
   - **Heuristic Fallback**: When `--allow-heuristic-fallback` is active and model loading fails, takes a bottom 30% height $\times$ 60% width crop of the vehicle bbox, sets `plate_detector_method = "heuristic"`, and hard-caps `plate_confidence <= 0.49`.
4. **Validation**: Every event is validated against `shared/schemas/detection.schema.json` before publishing.

### CLI Usage

```bash
# Dry-run image mode on CAM_006 (displays EasyOCR read vs Ground Truth XML annotation):
PYTHONPATH=ai-engine conda run -n pravaah python -m src.main --camera CAM_006 --source image --dry-run --limit 10

# Dry-run video mode on CAM_001 (CityFlow, frame-skip 5):
PYTHONPATH=ai-engine conda run -n pravaah python -m src.main --camera CAM_001 --source video --frame-skip 5 --dry-run --limit 20

# Run with heuristic fallback enabled (if offline or model weights unavailable):
PYTHONPATH=ai-engine conda run -n pravaah python -m src.main --camera CAM_006 --dry-run --limit 10 --allow-heuristic-fallback

# Publish live events to Kafka (requires Kafka broker at localhost:9092):
PYTHONPATH=ai-engine conda run -n pravaah python -m src.main --camera CAM_006
```

---

## 3. Part 2 — Synthetic Event Generator (`synthetic/`)

Generates realistic, schema-validated detection events without AI using `data/cameras.json` and its road-network adjacency graph.

### Features
1. **Scripted Planted Vehicles**:
   - `NORMAL_ROUTE`: `DL01AB1234` through central corridor (`CAM_001` -> `CAM_003` -> `CAM_007` -> `CAM_010`).
   - `BLACKLIST_HIT`: `MH12CD5678` (matches `data/blacklist_seed.json`) sighted at `CAM_002` and `CAM_006`.
   - `IMPOSSIBLE_TRAVEL`: `KA03EF9012` appears at `CAM_001` and `CAM_010` within 45 seconds (~12 km apart).
   - `NIGHT_MOVEMENT`: `UP14GH3456` enters restricted zone (`CAM_006`) late night.
2. **Background Traffic**: 50 random vehicles walking adjacent camera nodes with realistic vehicle type mix (car 55%, bike 25%, bus 10%, truck 7%, auto 3%), 20% unreadable plates.
3. **Deterministic & Speed Scaling**: Seeded random generator (`--seed 42`) and speed multiplier (`--speed 2.0`).
4. **Outputs**: Writes to `data/demo_events.jsonl` and publishes to Kafka `detections` topic.

### CLI Usage

```bash
# Dry-run generator (generates and writes data/demo_events.jsonl without Kafka):
PYTHONPATH=ai-engine conda run -n pravaah python -m synthetic --seed 42 --speed 1.0 --dry-run

# Publish synthetic events to Kafka:
PYTHONPATH=ai-engine conda run -n pravaah python -m synthetic --seed 42 --speed 2.0
```

---

## 4. Verification & Testing

### Running Unit Tests

```bash
PYTHONPATH=ai-engine conda run -n pravaah pytest ai-engine/tests/
```

### Verifying Kafka Ingestion

To inspect messages published to Kafka:
```bash
# If running native Kafka tools:
kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic detections --from-beginning

# Or via Docker:
docker exec -it pravaah-kafka kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic detections --from-beginning
```
