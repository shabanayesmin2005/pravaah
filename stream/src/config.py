"""stream/src/config.py
Configuration loader for PRAVAAH stream processors.
Reads root .env securely without logging or printing secrets.
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# Resolve repository root (stream/src/ -> stream/ -> repo_root/)
_REPO_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(_REPO_ROOT / ".env", override=False)


class StreamConfig:
    # ── Database Connections ──────────────────────────────────────────────────
    MONGO_URI: str = os.getenv(
        "MONGO_URI",
        "mongodb://pravaah_user:pravaah_pass@localhost:27017/pravaah?authSource=pravaah",
    )
    MONGO_DB_NAME: str = os.getenv("MONGO_DB_NAME", "pravaah")

    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379")

    # ── Kafka ─────────────────────────────────────────────────────────────────
    KAFKA_BROKERS: str = os.getenv("KAFKA_BROKERS", "localhost:9092")
    KAFKA_GROUP_ID: str = os.getenv("KAFKA_GROUP_ID_STREAM", "pravaah-stream")
    KAFKA_TOPIC_DETECTIONS: str = os.getenv("KAFKA_TOPIC_DETECTIONS", "detections")
    KAFKA_TOPIC_ALERTS: str = os.getenv("KAFKA_TOPIC_ALERTS", "alerts")
    KAFKA_TOPIC_ANALYTICS: str = os.getenv("KAFKA_TOPIC_ANALYTICS", "analytics")

    # ── Thresholds & Rules ────────────────────────────────────────────────────
    MAX_SPEED_KMH: float = float(os.getenv("MAX_SPEED_KMH", "120.0"))
    ALERT_COOLDOWN_SECONDS: int = int(os.getenv("ALERT_COOLDOWN_SECONDS", "300"))  # 5 min
    ANALYTICS_WINDOW_MINUTES: int = int(os.getenv("ANALYTICS_WINDOW_MINUTES", "5"))
    BASELINE_CAPACITY_PER_WINDOW: int = int(os.getenv("BASELINE_CAPACITY_PER_WINDOW", "50"))

    # ── File Paths ────────────────────────────────────────────────────────────
    REPO_ROOT: Path = _REPO_ROOT
    SCHEMA_PATH: Path = _REPO_ROOT / "shared" / "schemas" / "detection.schema.json"
    CAMERAS_JSON_PATH: Path = _REPO_ROOT / "data" / "cameras.json"
    BLACKLIST_SEED_PATH: Path = _REPO_ROOT / "data" / "blacklist_seed.json"
    DEMO_EVENTS_PATH: Path = _REPO_ROOT / "data" / "demo_events.jsonl"


config = StreamConfig()
