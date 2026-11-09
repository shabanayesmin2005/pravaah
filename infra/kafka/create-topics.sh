#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# create-topics.sh  — Kafka topic initialiser for PRAVAAH
# Runs once inside a bitnami/kafka container after the broker is healthy.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

BROKER="kafka:9092"
echo "==> PRAVAAH Kafka Topic Initialiser"
echo "    Broker: $BROKER"
echo ""

create_topic() {
  local topic=$1
  local partitions=$2
  local retention_ms=${3:-604800000}   # default 7 days

  echo "  Creating topic: $topic (partitions=$partitions, retention=${retention_ms}ms)"
  kafka-topics.sh \
    --bootstrap-server "$BROKER" \
    --create \
    --if-not-exists \
    --topic "$topic" \
    --partitions "$partitions" \
    --replication-factor 1 \
    --config "retention.ms=$retention_ms" \
    --config "compression.type=lz4"
}

# detections — high-volume, 3 partitions (one per camera group), 7 day retention
create_topic "detections"  3  604800000

# alerts — low-volume, 1 partition, 30 day retention
create_topic "alerts"      1  2592000000

# analytics — aggregated windows, 1 partition, 30 day retention
create_topic "analytics"   1  2592000000

echo ""
echo "==> Current topics:"
kafka-topics.sh --bootstrap-server "$BROKER" --list

echo ""
echo "✓ Kafka topics created successfully."
