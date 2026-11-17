"""
ai-engine/src/config.py
Loads the root .env file and exposes a typed Config singleton.
Secrets are NEVER printed or logged — this module only reads them.
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# Resolve the repo root (two levels above this file: src/ → ai-engine/ → repo/)
_REPO_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(_REPO_ROOT / ".env", override=False)


class Config:
    # ── Kafka ─────────────────────────────────────────────────────────────────
    KAFKA_BROKERS: str = os.getenv("KAFKA_BROKERS", "localhost:9092")
    KAFKA_TOPIC_DETECTIONS: str = os.getenv("KAFKA_TOPIC_DETECTIONS", "detections")

    # ── Plate detector ────────────────────────────────────────────────────────
    # HuggingFace model identifier — real working plate detector
    YOLO_PLATE_MODEL: str = os.getenv(
        "YOLO_PLATE_MODEL", "yasirfaizahmed/license-plate-object-detection"
    )
    YOLO_VEHICLE_MODEL: str = os.getenv("YOLO_VEHICLE_MODEL", "yolov8n.pt")

    # ── OCR ───────────────────────────────────────────────────────────────────
    OCR_BACKEND: str = os.getenv("OCR_BACKEND", "easyocr")  # always easyocr in Phase 2A

    # ── Snapshots ─────────────────────────────────────────────────────────────
    SNAPSHOT_DIR: Path = _REPO_ROOT / os.getenv(
        "SNAPSHOT_DIR", "backend/public/snapshots"
    )
    SNAPSHOT_BASE_URL: str = os.getenv(
        "SNAPSHOT_BASE_URL", "http://localhost:4000/snapshots"
    )

    # ── Source map ────────────────────────────────────────────────────────────
    SOURCE_MAP_PATH: Path = _REPO_ROOT / "ai-engine" / "camera_source_map.json"
    CAMERAS_JSON_PATH: Path = _REPO_ROOT / "data" / "cameras.json"
    BLACKLIST_SEED_PATH: Path = _REPO_ROOT / "data" / "blacklist_seed.json"
    SCHEMA_PATH: Path = _REPO_ROOT / "shared" / "schemas" / "detection.schema.json"
    DEMO_EVENTS_PATH: Path = _REPO_ROOT / "data" / "demo_events.jsonl"

    # ── Repo root (for resolving relative dataset paths) ──────────────────────
    REPO_ROOT: Path = _REPO_ROOT


# Single shared instance — import this everywhere
config = Config()
