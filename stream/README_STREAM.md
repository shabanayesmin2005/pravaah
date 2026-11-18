# PRAVAAH Stream Processor (stream/)

Stream processing engine for Smart India Hackathon 2026 (Problem Statement 26127).
Consumes detection events from Kafka, persists to MongoDB, constructs cross-camera trajectories with impossible-travel speed validation, evaluates Redis-backed alerts with cooldown deduplication, and aggregates windowed traffic analytics.

---

## Architecture Overview

```
[Kafka topic: detections]
          │
          ▼
┌────────────────────────────────────────────────────────┐
│  DetectionConsumer (Kafka -> MongoDB)                 │
│  - Validates against shared/schemas/detection.schema   │
│  - Idempotent upsert into collection 'detections'      │
│  - Enforces empty-plate rule (plate_text == "")        │
└─────────┬──────────────────────┬───────────────────────┘
          │                      │
          ▼                      ▼
┌──────────────────────┐ ┌───────────────────────────────┐
│ TrajectoryBuilder    │ │ AlertEngine                   │
│ - Chronological hops │ │ - BLACKLIST_HIT (Redis set)   │
│ - Graph road dist    │ │ - IMPOSSIBLE_TRAVEL (speed)   │
│ - Speed validation   │ │ - SUSPICIOUS_ROUTE (shuttle)  │
│ - Stores trajectories│ │ - Cooldown deduplication (5m) │
└─────────┬────────────┘ └──────────────┬────────────────┘
          │                             │
          ▼                             ▼
┌──────────────────────┐   [Kafka topic: alerts]
│ TrafficAnalytics     │   [MongoDB: alerts]
│ - 5-min camera window│
│ - Vehicle type mix   │
│ - Corridor speeds    │
│ - Congestion index   │
└─────────┬────────────┘
          │
          ▼
   [Kafka topic: analytics]
   [MongoDB: traffic_aggregates]
```

---

## Components

1. **`detection_consumer.py`**:
   - Ingests from Kafka `detections` topic.
   - Strictly validates every event against `shared/schemas/detection.schema.json`.
   - Creates indexes on `event_id`, `{camera_id, timestamp}`, and `{plate_text, timestamp}`.
   - **Empty plate rule**: Events with `plate_text == ""` are stored for traffic volume counts, but tagged with `has_plate: false`.

2. **`trajectory_builder.py`**:
   - Reconstructs ordered waypoints for all non-empty `plate_text`.
   - Uses Floyd-Warshall shortest-path matrix from `data/cameras.json` (with Haversine straight-line distance as lower-bound fallback).
   - Computes segment metrics: $\Delta t$, distance, and implied speed $v = \frac{\text{distance}}{\Delta t} \times 3.6$ km/h.
   - Flags segment and trajectory with `impossible_travel = True` if speed $> 120$ km/h (identifying cloned plates).

3. **`alert_engine.py`**:
   - Seeds Redis set `blacklist:plates` and MongoDB `blacklist` from `data/blacklist_seed.json` at startup.
   - Evaluates:
     - `BLACKLIST_HIT`: plate matches surveillance blacklist.
     - `IMPOSSIBLE_TRAVEL`: speed violation from trajectory builder.
     - `SUSPICIOUS_ROUTE`: repeated shuttling between camera pairs.
   - **Cooldown**: 5-minute deduplication via Redis key `alert:cooldown:{type}:{plate_text}` (`SET NX EX 300`).
   - Stores in MongoDB `alerts` collection and publishes to Kafka `alerts` topic.

4. **`traffic_analytics.py`**:
   - Computes 5-minute window aggregations per camera: total count (including unreadable plates), vehicle type breakdown (`car`, `bike`, `bus`, `truck`, `auto`), and average confidence.
   - Computes average speed and travel time between connected camera pairs.
   - Computes congestion index: $\min(1.0, \frac{\text{count}}{\text{capacity}})$.
   - Stores in MongoDB `traffic_aggregates` and publishes summary to Kafka `analytics` topic.

5. **`main.py`**:
   - Orchestrates all components.
   - Supports `--once` (batch pass mode) and continuous streaming mode.

---

## CLI Usage

### 1. Batch Pass Mode (`--once`)
Processes all available events in Kafka/MongoDB, computes trajectories, alerts, and analytics, then cleanly exits:
```bash
PYTHONPATH=stream conda run -n pravaah python -m src.main --once
```

### 2. Continuous Streaming Mode
Runs as a continuous background processor listening to incoming detections:
```bash
PYTHONPATH=stream conda run -n pravaah python -m src.main
```

### 3. Running Unit Tests
```bash
PYTHONPATH=stream conda run -n pravaah pytest stream/tests/
```
