"""stream/src/traffic_analytics.py
Traffic analytics aggregator for PRAVAAH.
Computes:
- 5-minute sliding window metrics per camera: total count (including plate_text=""),
  vehicle type mix (car, bike, bus, truck, auto), and average plate confidence.
- Average travel times & speeds between connected camera pairs (using non-empty plates only).
- Congestion index per camera segment.
- Persists into MongoDB 'traffic_aggregates' and publishes to Kafka 'analytics' topic.
"""

from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Optional

import dateutil.parser
from confluent_kafka import Producer
from loguru import logger
import pymongo
from pymongo.collection import Collection
from pymongo.database import Database

from .config import config


class TrafficAnalyticsAggregator:
    def __init__(
        self,
        mongo_db: Optional[Database] = None,
        kafka_producer: Optional[Producer] = None,
        window_minutes: Optional[int] = None,
        baseline_capacity: Optional[int] = None,
    ) -> None:
        # 1. MongoDB Setup
        if mongo_db is not None:
            self.db = mongo_db
        else:
            client = pymongo.MongoClient(config.MONGO_URI, serverSelectionTimeoutMS=5000)
            self.db = client[config.MONGO_DB_NAME]

        self.detections_col: Collection = self.db["detections"]
        self.aggregates_col: Collection = self.db["traffic_aggregates"]
        self.trajectories_col: Collection = self.db["trajectories"]
        self.ensure_indexes()

        # 2. Kafka Setup
        self.kafka_topic = config.KAFKA_TOPIC_ANALYTICS
        if kafka_producer is not None:
            self.producer = kafka_producer
        else:
            conf = {
                "bootstrap.servers": config.KAFKA_BROKERS,
                "client.id": "pravaah-analytics-aggregator",
                "linger.ms": 10,
                "acks": 1,
            }
            self.producer = Producer(conf)

        self.window_minutes = window_minutes or config.ANALYTICS_WINDOW_MINUTES
        self.baseline_capacity = baseline_capacity or config.BASELINE_CAPACITY_PER_WINDOW

    def ensure_indexes(self) -> None:
        try:
            self.aggregates_col.create_index(
                [("camera_id", pymongo.ASCENDING), ("window_start", pymongo.ASCENDING)],
                unique=True,
            )
            self.aggregates_col.create_index([("window_start", pymongo.ASCENDING)])
            logger.info("MongoDB 'traffic_aggregates' indexes ensured ✓")
        except Exception as exc:
            logger.warning(f"Could not create indexes on 'traffic_aggregates': {exc}")

    def _get_window_bounds(self, dt: datetime) -> tuple[datetime, datetime]:
        """Align datetime to nearest window_minutes boundary."""
        minute = (dt.minute // self.window_minutes) * self.window_minutes
        window_start = dt.replace(minute=minute, second=0, microsecond=0)
        window_end = window_start.replace(minute=minute + self.window_minutes if minute + self.window_minutes < 60 else 59, second=59 if minute + self.window_minutes >= 60 else 0)
        return window_start, window_end

    def aggregate_camera_windows(self) -> list[dict[str, Any]]:
        """
        Aggregate all stored detections into 5-minute window buckets per camera.
        All detections (including plate_text == "") are counted for volume and type mix.
        """
        cursor = self.detections_col.find({}, sort=[("timestamp", pymongo.ASCENDING)])
        detections = list(cursor)
        if not detections:
            logger.info("No detections available to aggregate.")
            return []

        # Group by (camera_id, window_start_iso)
        buckets: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)

        for d in detections:
            cam_id = d.get("camera_id")
            ts_str = d.get("timestamp")
            if not cam_id or not ts_str:
                continue

            try:
                dt = dateutil.parser.isoparse(ts_str)
            except Exception:
                continue

            w_start, w_end = self._get_window_bounds(dt)
            w_start_iso = w_start.isoformat()
            buckets[(cam_id, w_start_iso)].append(d)

        aggregates: list[dict[str, Any]] = []

        for (cam_id, w_start_iso), items in buckets.items():
            total_count = len(items)
            type_counts: dict[str, int] = defaultdict(int)
            confidences: list[float] = []

            for it in items:
                vtype = it.get("vehicle_type", "car")
                type_counts[vtype] += 1
                conf = it.get("plate_confidence", 0.0)
                if conf > 0:
                    confidences.append(conf)

            avg_conf = round(sum(confidences) / len(confidences), 4) if confidences else 0.0

            # Congestion index: ratio of count to baseline capacity
            congestion_idx = min(1.0, round(total_count / float(self.baseline_capacity), 2))

            agg_doc = {
                "camera_id": cam_id,
                "window_start": w_start_iso,
                "window_minutes": self.window_minutes,
                "vehicle_count": total_count,
                "type_mix": dict(type_counts),
                "avg_confidence": avg_conf,
                "congestion_index": congestion_idx,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }

            # Upsert into MongoDB
            self.aggregates_col.update_one(
                {"camera_id": cam_id, "window_start": w_start_iso},
                {"$set": agg_doc},
                upsert=True,
            )

            # Publish to Kafka 'analytics' topic
            try:
                payload = json.dumps(agg_doc).encode("utf-8")
                self.producer.produce(
                    topic=self.kafka_topic,
                    key=cam_id.encode("utf-8"),
                    value=payload,
                )
                self.producer.poll(0)
            except Exception as exc:
                logger.error(f"Failed to publish analytics to Kafka: {exc}")

            aggregates.append(agg_doc)
            logger.info(
                f"[ANALYTICS] Cam={cam_id} | Window={w_start_iso} | "
                f"Count={total_count} | Congestion={congestion_idx}"
            )

        return aggregates

    def aggregate_pair_speeds(self) -> list[dict[str, Any]]:
        """
        Aggregate average travel time and speeds between connected camera pairs
        using non-empty plate trajectories only.
        """
        cursor = self.trajectories_col.find({"impossible_travel": False})
        trajectories = list(cursor)

        pair_data: dict[tuple[str, str], list[tuple[float, float]]] = defaultdict(list)

        for t in trajectories:
            for seg in t.get("segments", []):
                if seg.get("impossible_travel"):
                    continue
                from_c = seg.get("from_camera")
                to_c = seg.get("to_camera")
                dt_s = seg.get("delta_time_s", 0)
                speed = seg.get("implied_speed_kmh", 0)
                if from_c and to_c and from_c != to_c and dt_s > 0:
                    pair_data[(from_c, to_c)].append((dt_s, speed))

        results: list[dict[str, Any]] = []
        for (from_c, to_c), samples in pair_data.items():
            if not samples:
                continue
            avg_dt = round(sum(s[0] for s in samples) / len(samples), 1)
            avg_spd = round(sum(s[1] for s in samples) / len(samples), 1)

            pair_doc = {
                "from_camera": from_c,
                "to_camera": to_c,
                "avg_travel_time_s": avg_dt,
                "avg_speed_kmh": avg_spd,
                "sample_count": len(samples),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            results.append(pair_doc)
            logger.info(
                f"[ANALYTICS-CORRIDOR] {from_c} -> {to_c} | "
                f"Avg Speed={avg_spd} km/h | Avg Time={avg_dt}s (samples={len(samples)})"
            )

        return results

    def run_all(self) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        """Run all analytics aggregations and return (window_aggregates, pair_speeds)."""
        windows = self.aggregate_camera_windows()
        pairs = self.aggregate_pair_speeds()
        if self.producer is not None:
            self.producer.flush(2.0)
        return windows, pairs
