"""stream/src/main.py
CLI orchestrator for the PRAVAAH stream processor.
Supports:
  --once: Single batch pass over Kafka topic & MongoDB (for demo/testing).
  Continuous mode (default): Streams live messages from Kafka, evaluates
  trajectories, triggers alerts, and updates analytics.
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

from loguru import logger
import pymongo
import redis

from .alert_engine import AlertEngine
from .config import config
from .detection_consumer import DetectionConsumer
from .traffic_analytics import TrafficAnalyticsAggregator
from .trajectory_builder import TrajectoryBuilder


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="PRAVAAH Stream Processor (Kafka -> MongoDB, Trajectories, Alerts, Analytics)"
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Run a single batch pass over available events and exit (ideal for demos and testing).",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=500,
        help="Maximum messages to consume in one batch pass (default 500).",
    )
    return parser.parse_args()


def run_batch_once(
    consumer: DetectionConsumer,
    traj_builder: TrajectoryBuilder,
    alert_engine: AlertEngine,
    analytics: TrafficAnalyticsAggregator,
    batch_size: int = 500,
) -> None:
    """Execute a single batch pass across the entire pipeline."""
    logger.info("=== Starting PRAVAAH Stream Batch Pass (--once) ===")

    # 1. Ingest from Kafka into MongoDB
    logger.info("1/4 Ingesting pending detection events from Kafka 'detections' topic...")
    consumed_events = consumer.consume_batch(max_messages=batch_size, timeout=4.0)
    logger.info(f"Ingested {len(consumed_events)} messages from Kafka into MongoDB ✓")

    # 2. Reconstruct Trajectories
    logger.info("2/4 Building vehicle trajectories for non-empty plates...")
    trajectories = traj_builder.build_all_trajectories()

    # 3. Evaluate Alerts
    logger.info("3/4 Evaluating alert rules (Blacklist, Impossible Travel, Suspicious Route)...")
    total_alerts = 0

    # Evaluate blacklist on all stored non-empty plate detections
    cursor = consumer.collection.find({"plate_text": {"$nin": ["", None]}})
    for d in cursor:
        alerts = alert_engine.evaluate_detection(d)
        total_alerts += len(alerts)

    # Evaluate trajectory alerts (impossible travel, suspicious route)
    for t in trajectories:
        alerts = alert_engine.evaluate_trajectory(t)
        total_alerts += len(alerts)

    alert_engine.flush()
    logger.info(f"Alert evaluation complete: {total_alerts} alerts triggered and emitted ✓")

    # 4. Traffic Analytics Aggregation
    logger.info("4/4 Aggregating traffic analytics windows & corridor speeds...")
    windows, pairs = analytics.run_all()
    logger.info(f"Traffic analytics complete: {len(windows)} windows, {len(pairs)} corridors computed ✓")

    logger.info("=== Batch Pass Complete Successfully ===")


def run_continuous(
    consumer: DetectionConsumer,
    traj_builder: TrajectoryBuilder,
    alert_engine: AlertEngine,
    analytics: TrafficAnalyticsAggregator,
) -> None:
    """Run continuous stream processing loop."""
    logger.info("=== Starting PRAVAAH Continuous Stream Processor ===")
    kafka_c = consumer.init_kafka_consumer()

    last_analytics_time = time.time()
    analytics_interval_s = 60.0

    try:
        while True:
            msg = kafka_c.poll(timeout=1.0)
            if msg is None:
                # Periodic analytics check
                if time.time() - last_analytics_time >= analytics_interval_s:
                    analytics.run_all()
                    last_analytics_time = time.time()
                continue

            if msg.error():
                logger.error(f"Kafka error: {msg.error()}")
                continue

            # Process detection
            ev = consumer.process_message(msg.value())
            if ev is None:
                continue

            # 1. Immediate detection alert (BLACKLIST_HIT)
            alert_engine.evaluate_detection(ev)

            # 2. Update trajectory if non-empty plate
            plate = ev.get("plate_text", "").strip()
            if plate:
                traj = traj_builder.build_trajectory_for_plate(plate)
                if traj:
                    alert_engine.evaluate_trajectory(traj)

    except KeyboardInterrupt:
        logger.info("Interrupted by user. Shutting down stream processor...")
    finally:
        consumer.close()
        alert_engine.flush()
        analytics.producer.flush()


def main() -> None:
    args = parse_args()

    # Shared DB clients
    mongo_client = pymongo.MongoClient(config.MONGO_URI, serverSelectionTimeoutMS=5000)
    db = mongo_client[config.MONGO_DB_NAME]
    r_client = redis.from_url(config.REDIS_URL, decode_responses=True)

    consumer = DetectionConsumer(mongo_db=db)
    traj_builder = TrajectoryBuilder(mongo_db=db)
    alert_engine = AlertEngine(mongo_db=db, redis_client=r_client)
    analytics = TrafficAnalyticsAggregator(mongo_db=db)

    if args.once:
        run_batch_once(
            consumer=consumer,
            traj_builder=traj_builder,
            alert_engine=alert_engine,
            analytics=analytics,
            batch_size=args.batch_size,
        )
    else:
        run_continuous(
            consumer=consumer,
            traj_builder=traj_builder,
            alert_engine=alert_engine,
            analytics=analytics,
        )


if __name__ == "__main__":
    main()
