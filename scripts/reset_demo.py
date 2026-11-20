"""scripts/reset_demo.py
Helper script for demo data reset.
Handles:
1. Purging derived MongoDB collections (detections, trajectories, alerts, traffic_aggregates).
2. Purging alert cooldown keys in Redis (alert:cooldown:*).
3. Seeking & committing the Kafka consumer group (pravaah-stream) offset to high watermark
   so stale messages in the topic are not re-consumed.
4. Printing final database counts cleanly.
"""

from __future__ import annotations

import argparse
import sys
from confluent_kafka import Consumer, TopicPartition
from loguru import logger
import pymongo
import redis

# Use config from stream processor to load environment securely without logging secrets
from stream.src.config import config

DERIVED_COLLECTIONS = ["detections", "trajectories", "alerts", "traffic_aggregates"]
PROTECTED_COLLECTIONS = ["users", "cameras", "blacklist", "audit_logs"]


def wipe_and_seek() -> None:
    """Wipe derived data and commit Kafka consumer group offsets to latest."""
    # 1. MongoDB cleanup
    client = pymongo.MongoClient(config.MONGO_URI, serverSelectionTimeoutMS=5000)
    db = client[config.MONGO_DB_NAME]

    for col in DERIVED_COLLECTIONS:
        res = db[col].delete_many({})
        # Note: Do not print passwords or secrets

    # Verify protected collections were untouched
    for pcol in PROTECTED_COLLECTIONS:
        if pcol not in db.list_collection_names():
            logger.warning(f"Protected collection '{pcol}' does not exist.")

    # 2. Redis cleanup (cooldown keys only)
    r = redis.Redis.from_url(config.REDIS_URL, decode_responses=True)
    cooldown_keys = list(r.scan_iter("alert:cooldown:*"))
    if cooldown_keys:
        r.delete(*cooldown_keys)

    # 3. Kafka offset advancement to high watermark
    # Advancing pravaah-stream group offsets prevents re-consuming old events with stale timestamps
    c = Consumer({
        "bootstrap.servers": config.KAFKA_BROKERS,
        "group.id": config.KAFKA_GROUP_ID,
        "enable.auto.commit": False,
    })
    meta = c.list_topics(topic=config.KAFKA_TOPIC_DETECTIONS, timeout=5.0)
    topic_meta = meta.topics.get(config.KAFKA_TOPIC_DETECTIONS)
    if topic_meta:
        partitions_to_commit = []
        for p_id in topic_meta.partitions:
            tp = TopicPartition(config.KAFKA_TOPIC_DETECTIONS, p_id)
            low, high = c.get_watermark_offsets(tp, timeout=5.0)
            tp.offset = high
            partitions_to_commit.append(tp)
        if partitions_to_commit:
            c.commit(offsets=partitions_to_commit)
    c.close()


def print_counts() -> None:
    """Print clean summary counts for derived data."""
    client = pymongo.MongoClient(config.MONGO_URI, serverSelectionTimeoutMS=5000)
    db = client[config.MONGO_DB_NAME]

    det_count = db.detections.count_documents({})
    traj_count = db.trajectories.count_documents({})
    agg_count = db.traffic_aggregates.count_documents({})

    alerts_by_type = {}
    for doc in db.alerts.aggregate([{"$group": {"_id": "$type", "count": {"$sum": 1}}}]):
        alerts_by_type[doc["_id"]] = doc["count"]

    print("\n========================================")
    print("=== PRAVAAH Demo Reset Complete ===")
    print(f"Detections: {det_count}")
    print(f"Trajectories: {traj_count}")
    print("Alerts by type:")
    for atype in ["BLACKLIST_HIT", "IMPOSSIBLE_TRAVEL", "SUSPICIOUS_ROUTE"]:
        print(f"  {atype}: {alerts_by_type.get(atype, 0)}")
    print(f"Traffic Aggregates: {agg_count}")
    print("========================================")


def main() -> None:
    parser = argparse.ArgumentParser(description="PRAVAAH demo reset helper")
    parser.add_argument("--wipe", action="store_true", help="Wipe derived data and advance Kafka offsets")
    parser.add_argument("--counts", action="store_true", help="Print summary counts")
    args = parser.parse_args()

    if args.wipe:
        wipe_and_seek()
    if args.counts:
        print_counts()


if __name__ == "__main__":
    main()
