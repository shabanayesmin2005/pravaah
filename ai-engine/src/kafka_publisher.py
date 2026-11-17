"""ai-engine/src/kafka_publisher.py
Kafka producer for PRAVAAH detection events.
Every event is strictly validated against detection.schema.json before sending.
In dry-run mode, logs/prints events without connecting to Kafka.
"""

from __future__ import annotations

import json
from typing import Optional

from confluent_kafka import Producer
from loguru import logger

from .config import config
from .models.detection import DetectionEvent
from .validator import EventValidator


class KafkaPublisher:
    def __init__(
        self,
        bootstrap_servers: Optional[str] = None,
        topic: Optional[str] = None,
        dry_run: bool = False,
        validator: Optional[EventValidator] = None,
    ) -> None:
        self.dry_run = dry_run
        self.topic = topic or config.KAFKA_TOPIC_DETECTIONS
        self.bootstrap_servers = bootstrap_servers or config.KAFKA_BROKERS
        self.validator = validator or EventValidator()
        self.producer: Optional[Producer] = None

        if not self.dry_run:
            logger.info(f"Connecting Kafka Producer to {self.bootstrap_servers} (topic={self.topic})")
            conf = {
                "bootstrap.servers": self.bootstrap_servers,
                "client.id": "pravaah-ai-engine",
                "compression.type": "lz4",
                "linger.ms": 20,
                "acks": 1,
            }
            try:
                self.producer = Producer(conf)
            except Exception as exc:
                logger.error(f"Failed to create Kafka producer: {exc}")
                raise

    def publish(self, event: DetectionEvent | dict) -> bool:
        """
        Validate and publish a detection event.
        Returns True if valid (and queued for publish or dry-run logged).
        """
        event_dict = event.to_kafka_dict() if isinstance(event, DetectionEvent) else event

        # 1. Schema Validation
        if not self.validator.validate(event_dict):
            logger.warning(f"Dropping invalid detection event: event_id={event_dict.get('event_id')}")
            return False

        payload_bytes = json.dumps(event_dict).encode("utf-8")
        key_bytes = str(event_dict.get("camera_id", "")).encode("utf-8")

        # 2. Dry run check
        if self.dry_run or self.producer is None:
            logger.info(
                f"[DRY-RUN] Published to '{self.topic}' | Cam: {event_dict.get('camera_id')} | "
                f"Track: {event_dict.get('track_id')} | Type: {event_dict.get('vehicle_type')} | "
                f"Plate: '{event_dict.get('plate_text')}' (conf: {event_dict.get('plate_confidence')}) | "
                f"Method: {event_dict.get('plate_detector_method', 'N/A')}"
            )
            return True

        # 3. Publish to Kafka
        try:
            self.producer.produce(
                topic=self.topic,
                key=key_bytes,
                value=payload_bytes,
                callback=self._delivery_callback,
            )
            # Poll to trigger callbacks
            self.producer.poll(0)
            return True
        except BufferError:
            logger.warning("Kafka local queue full, waiting for flush...")
            self.producer.poll(50)
            self.producer.produce(topic=self.topic, key=key_bytes, value=payload_bytes)
            return True
        except Exception as exc:
            logger.error(f"Kafka produce error: {exc}")
            return False

    def _delivery_callback(self, err, msg):
        if err is not None:
            logger.error(f"Kafka message delivery failed: {err}")

    def flush(self, timeout: float = 5.0) -> None:
        if self.producer is not None:
            logger.info("Flushing Kafka producer...")
            self.producer.flush(timeout)
