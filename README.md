# PRAVAAH (प्रवाह)

**AI-Powered City-Wide Vehicle Tracking & Traffic Intelligence Platform**

> Smart India Hackathon 2026 · Problem Statement 26127
> *"City-Wide AI Engine for Multi-Camera ANPR Trajectory Tracking and Urban Traffic Analytics"*

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Quick Start](#quick-start)
4. [Project Structure](#project-structure)
5. [Camera Network](#camera-network)
6. [Detection Event Contract](#detection-event-contract)
7. [Services & Ports](#services--ports)
8. [Environment Variables](#environment-variables)
9. [Development Guide](#development-guide)
10. [Demo Script](#demo-script)
11. [Known Limitations](#known-limitations)
12. [Team](#team)

---

## Overview

PRAVAAH (meaning *"flow"* in Sanskrit) is a city-wide intelligent traffic monitoring platform that:

- Ingests feeds from **10 simulated ANPR/CCTV cameras** (looped video + scripted planted vehicles)
- **Detects vehicles** and **reads number plates** using YOLO + ByteTrack + PaddleOCR
- **Links the same vehicle across cameras** using plate text and appearance embeddings
- **Reconstructs trajectories** validated against a road-adjacency graph
- **Flags anomalies**: blacklist hits, impossible travel (cloned plates), congestion, restricted-zone violations
- Streams everything to a **GIS dark-theme dashboard** for traffic authorities

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                   Simulated Camera Network                          │
│  10 looped video files + planted-vehicle generator (scripted routes)│
└──────────────────────────┬──────────────────────────────────────────┘
                           │  OpenCV frames
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     ai-engine/  (Python 3.11)                       │
│  YOLO v8 detection → ByteTrack → Plate YOLO → PaddleOCR            │
│  Multi-frame voting → Indian plate validator → Kafka producer        │
└──────────────────────────┬──────────────────────────────────────────┘
                           │  topic: detections (JSON)
                           ▼
                    ┌─────────────┐
                    │  Kafka      │  KRaft mode, single broker
                    │  (Docker)   │  topics: detections, alerts, analytics
                    └──────┬──────┘
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
    store_consumer  trajectory_builder  analytics_aggregator
          │                │                │
          └────────────────┴────────────────┘
                           │
                    alert_engine ──→ topic: alerts
                           │
                    ┌──────▼──────────────────────┐
                    │  MongoDB 7      Redis 7      │
                    │  (persistence)  (live state, │
                    │                 blacklist)   │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │  backend/  (Node.js + TS)   │
                    │  Express REST API + Socket.IO│
                    │  JWT auth, RBAC, audit log  │
                    └──────────────┬──────────────┘
                                   │  REST + WebSocket
                    ┌──────────────▼──────────────┐
                    │  frontend/  (React + Vite)  │
                    │  Dark control-room dashboard │
                    │  Leaflet map + Recharts      │
                    └─────────────────────────────┘
```

---

## Quick Start

### Prerequisites

| Tool | Version |
|------|---------|
| Docker | ≥ 24.0 |
| Docker Compose | ≥ 2.24 |
| Node.js | ≥ 20.0 |
| Python | 3.11 |

### 1. Clone & configure

```bash
git clone <repo-url> pravaah
cd pravaah
cp .env.example .env
# Edit .env — change all CHANGE_ME values
```

### 2. Start infrastructure

```bash
npm run infra:up
# Starts: Kafka (KRaft), MongoDB, Redis, and kafka-init (topic creator)
```

**Verify services are healthy:**

```bash
npm run infra:ps
# All services should show "healthy" or "running"
```

### 3. Check each service

```bash
# Kafka — list topics (should show: detections, alerts, analytics)
docker exec pravaah-kafka kafka-topics.sh \
  --bootstrap-server localhost:9092 --list

# MongoDB — ping
docker exec pravaah-mongodb mongosh \
  --quiet --eval "db.adminCommand('ping')"

# Redis — ping
docker exec pravaah-redis redis-cli ping
# → PONG
```

### 4. Start dev UIs (optional)

```bash
docker-compose -f infra/docker-compose.yml --profile dev up -d
# Kafka UI:     http://localhost:8080
# Mongo Express: http://localhost:8081  (admin / pravaah_dev)
```

### 5. Install Node packages

```bash
npm install
npm run build:shared
```

> **Phase 2 and beyond** — see each sub-folder's README for running the AI engine, stream processors, backend, and frontend.

---

## Project Structure

```
pravaah/
├── ai-engine/      Python AI worker: YOLO + ByteTrack + OCR + Kafka producer
├── stream/         Python Kafka consumers: store, trajectory, analytics, alerts
├── backend/        Node.js + TS REST API + Socket.IO
├── frontend/       React + Vite + TS dashboard
├── shared/         Shared TypeScript types & JSON schemas (npm workspace)
├── scripts/        Seed and replay TypeScript scripts (npm workspace)
├── infra/          docker-compose.yml, Kafka/Mongo/Redis configs
├── data/
│   ├── cameras.json          10 cameras + adjacency graph
│   ├── blacklist_seed.json   Sample blacklist entries
│   ├── video_samples/        Place looped MP4s here (gitignored)
│   └── datasets/             Drop Indian plate dataset here (gitignored)
├── docs/           Architecture details, API docs, demo script
├── .env.example    All environment variables documented
└── README.md       This file
```

---

## Camera Network

10 simulated cameras placed at real Delhi/NCR intersections:

| ID | Location | Zone | GPS |
|----|----------|------|-----|
| CAM_001 | Connaught Place – Inner Circle | Commercial | 28.6315, 77.2167 |
| CAM_002 | India Gate – Kartavya Path | Restricted | 28.6129, 77.2295 |
| CAM_003 | ITO Chowk | Commercial | 28.6286, 77.2410 |
| CAM_004 | Kashmere Gate Metro | Transit | 28.6671, 77.2285 |
| CAM_005 | Anand Vihar ISBT | Transit | 28.6469, 77.3159 |
| CAM_006 | Lajpat Nagar Metro | Commercial | 28.5684, 77.2374 |
| CAM_007 | Nehru Place | Commercial | 28.5491, 77.2543 |
| CAM_008 | Dwarka Sector 10 | Residential | 28.5940, 77.0387 |
| CAM_009 | Rohini Sector 15 | Residential | 28.7225, 77.1226 |
| CAM_010 | Noida Sector 18 | Commercial | 28.5679, 77.3200 |

The adjacency graph in `data/cameras.json` encodes 15 road-connected pairs with distances and expected travel times. See `shared/types/camera.ts` for the full type definition.

---

## Detection Event Contract

All services communicate using this JSON structure (Kafka `detections` topic):

```jsonc
{
  "event_id": "550e8400-e29b-41d4-a716-446655440000",  // UUID v4
  "camera_id": "CAM_001",                               // matches cameras.json
  "timestamp": "2026-11-09T08:12:34.567Z",             // ISO-8601 UTC (frame time)
  "plate_text": "DL01AB1234",                           // empty if unreadable
  "plate_confidence": 0.91,                             // 0.0 – 1.0
  "vehicle_type": "car",                                // car|bike|bus|truck|auto
  "bbox": [120, 45, 380, 210],                          // [x1, y1, x2, y2] pixels
  "track_id": 57,                                       // ByteTrack ID (per-camera)
  "snapshot_url": "/snapshots/CAM_001/57_20261109_081234.jpg"
}
```

TypeScript source: [`shared/types/detection.ts`](shared/types/detection.ts)
JSON Schema: [`shared/schemas/detection.schema.json`](shared/schemas/detection.schema.json)
Python Pydantic model: `ai-engine/src/models/detection.py` *(Phase 2)*

---

## Services & Ports

| Service | Port | URL | Credentials |
|---------|------|-----|-------------|
| Backend API | 4000 | http://localhost:4000/api/v1 | JWT (see seed) |
| Frontend | 5173 (dev) | http://localhost:5173 | — |
| Kafka broker | 9092 | — | none |
| Kafka external | 9094 | localhost:9094 | none |
| MongoDB | 27017 | — | see .env |
| Redis | 6379 | — | see .env |
| Kafka UI *(dev)* | 8080 | http://localhost:8080 | none |
| Mongo Express *(dev)* | 8081 | http://localhost:8081 | admin / pravaah_dev |

---

## Environment Variables

All variables are documented in [`.env.example`](.env.example).
Copy it to `.env` and fill in your values before starting any service.

**Never commit `.env` to version control.**

---

## Development Guide

### Running individual phases

```bash
# Phase 1 — just infra (this phase)
npm run infra:up

# Phase 2 — AI engine (after placing video files)
cd ai-engine && python -m src.main

# Phase 3 — Stream processors
cd stream && python -m src.main

# Phase 4 — Backend
npm run dev:backend

# Phase 5 — Frontend
npm run dev:frontend
```

### Seeding demo data (Phase 4+)

```bash
npm run seed
# Creates: 4 demo users, cameras, blacklist entries, demo scenario
```

### Demo replay mode (no GPU needed)

```bash
npm run replay
# Streams pre-generated events from data/demo_events.jsonl at 2× speed
```

### Running tests

```bash
npm run test:shared    # shared type utilities
npm run test:backend   # backend auth, RBAC, routes
cd ai-engine && pytest tests/  # plate validator, voting, char correction
cd stream && pytest tests/     # trajectory builder, alert rules
```

---

## Demo Scenario

The `data/cameras.json` includes 4 scripted planted-vehicle routes:

| Vehicle | Route | Expected Alert |
|---------|-------|----------------|
| `DL01AB1234` | CAM_001 → 003 → 007 → 010 | None — normal commute |
| `MH12CD5678` | CAM_002 → 006 | **BLACKLIST_HIT** (pre-seeded) |
| `KA03EF9012` | CAM_001 → CAM_010 in 45s | **IMPOSSIBLE_TRAVEL** (~12 km) |
| `UP14GH3456` | CAM_006 at 23:00+ | **NIGHT_MOVEMENT_RESTRICTED_ZONE** |

Full demo script: [`docs/demo_script.md`](docs/demo_script.md) *(added in Phase 6)*

---

## RBAC Roles

| Role | Full Plate Access | Trajectory | Analytics | Admin |
|------|-------------------|-----------|-----------|-------|
| Admin | ✅ | ✅ | ✅ | ✅ |
| TrafficAuthority | ✅ | ✅ | ✅ | ❌ |
| Police | ✅ | ✅ | ✅ | ❌ |
| Analyst | ❌ Masked | Masked | ✅ | ❌ |

Demo credentials after `npm run seed`:

| Email | Password | Role |
|-------|----------|------|
| admin@pravaah.local | *see .env SEED_ADMIN_PASSWORD* | Admin |
| traffic@pravaah.local | Traffic@2026 | TrafficAuthority |
| police@pravaah.local | Police@2026 | Police |
| analyst@pravaah.local | Analyst@2026 | Analyst |

---

## Known Limitations

> These are honest limitations, not marketing claims.

- **OCR accuracy is not benchmarked on real city footage.** The evaluation script (`ai-engine/scripts/evaluate.py`) measures on a held-out subset of the Indian Number Plates dataset, which may not represent real-world camera angles, lighting, and motion blur.
- **Single Kafka broker** — not fault-tolerant. For production, use a 3-broker cluster with replication-factor ≥ 2.
- **Simulated cameras ≠ real RTSP feeds.** Looped video files have no network jitter, packet loss, or authentication. Real deployment would require an RTSP library (e.g., GStreamer or FFmpeg) instead of `cv2.VideoCapture`.
- **Vehicle Re-ID (OSNet)** is an optional stub built in Phase 6. It has not been tuned on Indian traffic data and should be considered experimental.
- **No GPU in Docker by default.** CPU inference with YOLO + PaddleOCR processes roughly 2–5 FPS per camera on modern hardware. GPU support can be enabled by swapping to the CUDA-enabled base image.
- **No TLS/HTTPS in development.** For production, add Let's Encrypt certificates behind the Nginx reverse proxy.
- **Plate char correction** (O/0, I/1, B/8, S/5) uses position-based heuristics. It may over-correct edge cases.
- **Data retention TTL** is enforced by MongoDB TTL indexes. Under heavy load, TTL cleanup may lag.

---

## Phase Completion Status

| Phase | Description | Status |
|-------|-------------|--------|
| **1** | Monorepo skeleton, Docker infra, shared types, cameras.json | ✅ Complete |
| **2** | Python AI engine (YOLO + OCR + Kafka) | 🔲 Pending |
| **3** | Stream processors (trajectory, analytics, alerts) | 🔲 Pending |
| **4** | Node.js backend (REST + WebSocket + auth) | 🔲 Pending |
| **5** | React dashboard | 🔲 Pending |
| **6** | E2E test, replay mode, demo polish | 🔲 Pending |

---

## Team

PRAVAAH — SIH 2026, Problem Statement 26127

*Built with ❤️ for Indian cities.*
