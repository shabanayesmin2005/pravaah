"""stream/src/alert_engine.py
Alert engine for PRAVAAH.
Handles:
- BLACKLIST_HIT (Redis-backed blacklist set + MongoDB)
- IMPOSSIBLE_TRAVEL (triggered by trajectory speed violations)
- SUSPICIOUS_ROUTE (rapid loops / oscillation between camera pairs)
- Cooldown deduplication via Redis (5-minute window)
- Storage in MongoDB 'alerts' collection + publication to Kafka 'alerts' topic.
NOTE: Events with plate_text == "" are STRICTLY excluded from alert evaluation.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from confluent_kafka import Producer
from loguru import logger
import pymongo
from pymongo.collection import Collection
from pymongo.database import Database
import redis

from .config import config


class AlertEngine:
    def __init__(
        self,
        mongo_db: Optional[Database] = None,
        redis_client: Optional[redis.Redis] = None,
        kafka_producer: Optional[Producer] = None,
        cooldown_seconds: Optional[int] = None,
        blacklist_seed_path: Optional[Path | str] = None,
    ) -> None:
        # 1. MongoDB Setup
        if mongo_db is not None:
            self.db = mongo_db
        else:
            client = pymongo.MongoClient(config.MONGO_URI, serverSelectionTimeoutMS=5000)
            self.db = client[config.MONGO_DB_NAME]

        self.alerts_col: Collection = self.db["alerts"]
        self.blacklist_col: Collection = self.db["blacklist"]
        self.ensure_indexes()

        # 2. Redis Setup
        if redis_client is not None:
            self.redis = redis_client
        else:
            self.redis = redis.from_url(config.REDIS_URL, decode_responses=True)

        # 3. Kafka Producer Setup
        self.kafka_topic = config.KAFKA_TOPIC_ALERTS
        if kafka_producer is not None:
            self.producer = kafka_producer
        else:
            conf = {
                "bootstrap.servers": config.KAFKA_BROKERS,
                "client.id": "pravaah-alert-engine",
                "linger.ms": 10,
                "acks": 1,
            }
            self.producer = Producer(conf)

        self.cooldown_seconds = cooldown_seconds or config.ALERT_COOLDOWN_SECONDS
        self.seed_blacklist(blacklist_seed_path or config.BLACKLIST_SEED_PATH)

    def ensure_indexes(self) -> None:
        try:
            self.alerts_col.create_index("alert_id", unique=True)
            self.alerts_col.create_index([("type", pymongo.ASCENDING), ("timestamp", pymongo.DESCENDING)])
            self.alerts_col.create_index([("plate_text", pymongo.ASCENDING), ("timestamp", pymongo.DESCENDING)])
            self.alerts_col.create_index("camera_id")
            self.alerts_col.create_index([("status", pymongo.ASCENDING), ("severity", pymongo.ASCENDING)])

            self.blacklist_col.create_index("plate_text", unique=True)
            logger.info("MongoDB 'alerts' & 'blacklist' indexes ensured ✓")
        except Exception as exc:
            logger.warning(f"Could not create indexes on 'alerts': {exc}")

    def seed_blacklist(self, seed_path: Path | str) -> int:
        """Seed Redis set 'blacklist:plates' and MongoDB 'blacklist' collection from JSON file."""
        p = Path(seed_path)
        if not p.exists():
            logger.warning(f"Blacklist seed file not found at {p}")
            return 0

        with open(p, "r", encoding="utf-8") as f:
            entries = json.load(f)

        seeded_count = 0
        for entry in entries:
            plate = entry.get("plate_text", "").strip()
            if not plate:
                continue

            # 1. Seed into MongoDB
            self.blacklist_col.update_one(
                {"plate_text": plate},
                {"$set": entry},
                upsert=True,
            )

            # 2. Seed into Redis set
            self.redis.sadd("blacklist:plates", plate)

            # Store metadata in Redis hash for fast detail lookup
            meta_json = json.dumps({
                "reason": entry.get("reason", ""),
                "severity": entry.get("severity", "HIGH"),
                "agency": entry.get("agency", ""),
            })
            self.redis.hset("blacklist:details", plate, meta_json)
            seeded_count += 1

        logger.info(f"Seeded {seeded_count} plates into Redis set 'blacklist:plates' and MongoDB ✓")
        return seeded_count

    def is_blacklisted(self, plate_text: str) -> bool:
        """Check if plate is in Redis blacklist set. Empty plates always return False."""
        clean = plate_text.strip()
        if not clean:
            return False
        return bool(self.redis.sismember("blacklist:plates", clean))

    def get_blacklist_info(self, plate_text: str) -> dict[str, Any]:
        """Fetch blacklist details for a plate."""
        clean = plate_text.strip()
        raw = self.redis.hget("blacklist:details", clean)
        if raw:
            try:
                return json.loads(raw)
            except Exception:
                pass
        return {"reason": "Vehicle on surveillance blacklist", "severity": "HIGH", "agency": "Police"}

    def _check_and_set_cooldown(self, alert_type: str, plate_text: str) -> bool:
        """
        Returns True if alert is allowed (not in cooldown).
        Returns False if suppressed by cooldown window.
        """
        key = f"alert:cooldown:{alert_type}:{plate_text}"
        # SET key 1 EX cooldown_seconds NX -> returns True if set, None/False if key exists
        res = self.redis.set(key, "1", ex=self.cooldown_seconds, nx=True)
        return bool(res)

    def emit_alert(
        self,
        alert_type: str,
        plate_text: str,
        camera_id: str,
        timestamp: str,
        severity: str,
        description: str,
        snapshot_url: str = "",
        metadata: Optional[dict[str, Any]] = None,
    ) -> Optional[dict[str, Any]]:
        """
        Check cooldown, record in MongoDB, and publish to Kafka 'alerts' topic.
        """
        clean_plate = plate_text.strip()
        if not clean_plate:
            # Rule: empty plate never triggers alerts
            return None

        # Check cooldown deduplication
        if not self._check_and_set_cooldown(alert_type, clean_plate):
            logger.debug(f"[ALERT-COOLDOWN] Suppressed duplicate {alert_type} for {clean_plate}")
            return None

        alert_id = str(uuid.uuid4())
        created_at = datetime.now(timezone.utc).isoformat()

        alert_doc = {
            "alert_id": alert_id,
            "type": alert_type,
            "plate_text": clean_plate,
            "camera_id": camera_id,
            "timestamp": timestamp,
            "severity": severity,
            "description": description,
            "snapshot_url": snapshot_url,
            "acknowledged": False,
            "status": "OPEN",
            "metadata": metadata or {},
            "created_at": created_at,
        }

        # 1. Save to MongoDB
        try:
            self.alerts_col.insert_one(dict(alert_doc))
        except Exception as exc:
            logger.error(f"Failed to persist alert in MongoDB: {exc}")

        # 2. Publish to Kafka 'alerts' topic
        try:
            payload_bytes = json.dumps(alert_doc).encode("utf-8")
            self.producer.produce(
                topic=self.kafka_topic,
                key=clean_plate.encode("utf-8"),
                value=payload_bytes,
            )
            self.producer.poll(0)
        except Exception as exc:
            logger.error(f"Failed to publish alert to Kafka topic '{self.kafka_topic}': {exc}")

        logger.warning(
            f"[ALERT] {alert_type} | plate={clean_plate} | cam={camera_id} | "
            f"severity={severity} | desc='{description}'"
        )
        return alert_doc

    def evaluate_detection(self, detection: dict[str, Any]) -> list[dict[str, Any]]:
        """Check a single detection for immediate alerts (e.g. BLACKLIST_HIT)."""
        alerts: list[dict[str, Any]] = []
        plate = detection.get("plate_text", "").strip()
        if not plate:
            return alerts

        # Check BLACKLIST_HIT
        if self.is_blacklisted(plate):
            info = self.get_blacklist_info(plate)
            alert = self.emit_alert(
                alert_type="BLACKLIST_HIT",
                plate_text=plate,
                camera_id=detection.get("camera_id", ""),
                timestamp=detection.get("timestamp", datetime.now(timezone.utc).isoformat()),
                severity=info.get("severity", "HIGH"),
                description=f"Blacklisted vehicle sighted: {info.get('reason', '')} (Agency: {info.get('agency', 'Police')})",
                snapshot_url=detection.get("snapshot_url", ""),
                metadata={"reason": info.get("reason"), "agency": info.get("agency")},
            )
            if alert:
                alerts.append(alert)

        return alerts

    def evaluate_trajectory(self, trajectory: dict[str, Any]) -> list[dict[str, Any]]:
        """Check a trajectory for IMPOSSIBLE_TRAVEL and SUSPICIOUS_ROUTE alerts."""
        alerts: list[dict[str, Any]] = []
        plate = trajectory.get("plate_text", "").strip()
        if not plate:
            return alerts

        segments = trajectory.get("segments", [])
        waypoints = trajectory.get("waypoints", [])

        # 1. IMPOSSIBLE_TRAVEL check
        for seg in segments:
            if seg.get("impossible_travel"):
                speed = seg.get("implied_speed_kmh", 0)
                from_cam = seg.get("from_camera", "")
                to_cam = seg.get("to_camera", "")
                dist_m = seg.get("distance_m", 0)
                delta_s = seg.get("delta_time_s", 0)

                # Use last waypoint snapshot
                snap = waypoints[-1].get("snapshot_url", "") if waypoints else ""
                ts = waypoints[-1].get("timestamp", datetime.now(timezone.utc).isoformat()) if waypoints else ""

                alert = self.emit_alert(
                    alert_type="IMPOSSIBLE_TRAVEL",
                    plate_text=plate,
                    camera_id=to_cam,
                    timestamp=ts,
                    severity="CRITICAL",
                    description=(
                        f"Physically impossible travel detected: {dist_m}m in {delta_s}s "
                        f"(implied speed {speed} km/h > threshold {config.MAX_SPEED_KMH} km/h) "
                        f"between {from_cam} and {to_cam}. Possible cloned plate."
                    ),
                    snapshot_url=snap,
                    metadata=seg,
                )
                if alert:
                    alerts.append(alert)

        # 2. SUSPICIOUS_ROUTE check (e.g. oscillating between 2 cameras >= 3 times)
        if len(waypoints) >= 4:
            cam_sequence = [wp["camera_id"] for wp in waypoints]
            # Check for A-B-A-B repetition in sequence
            for i in range(len(cam_sequence) - 3):
                if cam_sequence[i] == cam_sequence[i + 2] and cam_sequence[i + 1] == cam_sequence[i + 3] and cam_sequence[i] != cam_sequence[i + 1]:
                    alert = self.emit_alert(
                        alert_type="SUSPICIOUS_ROUTE",
                        plate_text=plate,
                        camera_id=cam_sequence[i + 3],
                        timestamp=waypoints[i + 3]["timestamp"],
                        severity="MEDIUM",
                        description=f"Vehicle repeatedly shuttled between {cam_sequence[i]} and {cam_sequence[i+1]}.",
                        snapshot_url=waypoints[i + 3].get("snapshot_url", ""),
                        metadata={"cameras": [cam_sequence[i], cam_sequence[i + 1]]},
                    )
                    if alert:
                        alerts.append(alert)
                    break

        return alerts

    def flush(self, timeout: float = 2.0) -> None:
        if self.producer is not None:
            self.producer.flush(timeout)
