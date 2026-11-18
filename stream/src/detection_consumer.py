"""stream/src/detection_consumer.py
Kafka consumer that validates detection events against detection.schema.json
and idempotently upserts them into MongoDB 'detections' collection.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Optional

import jsonschema
from jsonschema import Draft7Validator
from confluent_kafka import Consumer, KafkaError
from loguru import logger
import pymongo
from pymongo.collection import Collection
from pymongo.database import Database

from .config import config


class DetectionConsumer:
    def __init__(
        self,
        mongo_db: Optional[Database] = None,
        bootstrap_servers: Optional[str] = None,
        group_id: Optional[str] = None,
        topic: Optional[str] = None,
        schema_path: Optional[Path | str] = None,
    ) -> None:
        # 1. MongoDB Setup
        if mongo_db is not None:
            self.db = mongo_db
        else:
            client = pymongo.MongoClient(config.MONGO_URI, serverSelectionTimeoutMS=5000)
            self.db = client[config.MONGO_DB_NAME]

        self.collection: Collection = self.db["detections"]
        self.ensure_indexes()

        # 2. Schema Validator Setup
        p = Path(schema_path or config.SCHEMA_PATH)
        if not p.exists():
            raise FileNotFoundError(f"Detection schema not found at {p}")
        with open(p, "r", encoding="utf-8") as f:
            schema_data = json.load(f)
        Draft7Validator.check_schema(schema_data)
        self.validator = Draft7Validator(schema_data)

        # 3. Kafka Consumer Setup
        self.bootstrap_servers = bootstrap_servers or config.KAFKA_BROKERS
        self.group_id = group_id or config.KAFKA_GROUP_ID
        self.topic = topic or config.KAFKA_TOPIC_DETECTIONS
        self.consumer: Optional[Consumer] = None

    def init_kafka_consumer(self, auto_offset_reset: str = "earliest") -> Consumer:
        """Create and subscribe Kafka consumer."""
        conf = {
            "bootstrap.servers": self.bootstrap_servers,
            "group.id": self.group_id,
            "auto.offset.reset": auto_offset_reset,
            "enable.auto.commit": True,
        }
        self.consumer = Consumer(conf)
        self.consumer.subscribe([self.topic])
        logger.info(
            f"Subscribed Kafka consumer to {self.topic} "
            f"(brokers={self.bootstrap_servers}, group={self.group_id})"
        )
        return self.consumer

    def ensure_indexes(self) -> None:
        """Ensure indexes exist for rapid querying and deduplication."""
        try:
            self.collection.create_index("event_id", unique=True)
            self.collection.create_index([("camera_id", pymongo.ASCENDING), ("timestamp", pymongo.ASCENDING)])
            self.collection.create_index([("plate_text", pymongo.ASCENDING), ("timestamp", pymongo.ASCENDING)])
            self.collection.create_index([("timestamp", pymongo.ASCENDING)])
            logger.info("MongoDB 'detections' indexes ensured ✓")
        except Exception as exc:
            logger.warning(f"Could not create indexes on 'detections': {exc}")

    def validate_event(self, event_dict: dict[str, Any]) -> bool:
        """Validate event dictionary against shared JSON schema."""
        errors = list(self.validator.iter_errors(event_dict))
        if errors:
            for err in errors:
                loc = ".".join(str(p) for p in err.path) or "root"
                logger.error(f"Schema validation error at [{loc}]: {err.message}")
            return False
        return True

    def store_event(self, event_dict: dict[str, Any]) -> bool:
        """
        Validate and upsert detection event into MongoDB.
        Returns True if stored/updated, False if invalid or failed.
        """
        if not self.validate_event(event_dict):
            logger.warning(f"Rejecting invalid event: {event_dict.get('event_id')}")
            return False

        event_id = event_dict["event_id"]
        # Add metadata helper for plate presence
        doc = dict(event_dict)
        doc["has_plate"] = bool(doc.get("plate_text", "").strip())

        try:
            self.collection.update_one(
                {"event_id": event_id},
                {"$set": doc},
                upsert=True,
            )
            return True
        except Exception as exc:
            logger.error(f"MongoDB upsert failed for event {event_id}: {exc}")
            return False

    def process_message(self, raw_bytes: bytes) -> Optional[dict[str, Any]]:
        """Parse, validate, and store a raw Kafka message value."""
        try:
            payload = json.loads(raw_bytes.decode("utf-8"))
        except Exception as exc:
            logger.error(f"Failed to decode Kafka JSON payload: {exc}")
            return None

        if self.store_event(payload):
            cam = payload.get("camera_id")
            track = payload.get("track_id")
            plate = payload.get("plate_text")
            logger.info(
                f"[CONSUMER] Stored detection | cam={cam} | track={track} | "
                f"plate='{plate}' | type={payload.get('vehicle_type')}"
            )
            return payload
        return None

    def consume_batch(self, max_messages: int = 100, timeout: float = 2.0) -> list[dict[str, Any]]:
        """
        Consume a batch of messages. Useful for batch passes (--once).
        """
        if self.consumer is None:
            self.init_kafka_consumer()

        stored_events: list[dict[str, Any]] = []
        messages = self.consumer.consume(num_messages=max_messages, timeout=timeout)
        for msg in messages:
            if msg.error():
                if msg.error().code() != KafkaError._PARTITION_EOF:
                    logger.error(f"Kafka error: {msg.error()}")
                continue
            ev = self.process_message(msg.value())
            if ev is not None:
                stored_events.append(ev)

        return stored_events

    def close(self) -> None:
        if self.consumer is not None:
            self.consumer.close()
            logger.info("Closed detection consumer")
