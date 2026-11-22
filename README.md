# PRAVAAH (प्रवाह)

**AI-powered city-wide vehicle tracking and traffic intelligence.**
Smart India Hackathon 2026 · Problem Statement 26127 · Team SIREN (Team ID 132201)

> **Prototype notice:** the camera network, vehicles, incidents and blacklist are simulated sample data. Every dashboard page carries a "DEMO DATA (simulated)" badge.

## What it does

- Reads number plates (vehicle detection, plate detection, OCR) and publishes one JSON event per sighting.
- Rebuilds each vehicle's journey across cameras, with distance, time and speed per segment.
- Raises alerts: blacklisted vehicle, impossible travel (possible cloned plate, over 120 km/h) and suspicious shuttle route.
- Turns the same data into traffic analytics: counts, vehicle mix and a congestion index per camera in 5-minute windows.
- Protects privacy: four roles (Admin, Police, Traffic Authority, Analyst), masked plates for analysts, and a full audit trail.

## Architecture

    Cameras (simulated) -> AI engine (YOLOv8n + ByteTrack + plate detector + EasyOCR)
        -> Kafka -> stream processors (trajectories, alerts, analytics)
        -> MongoDB + Redis -> Node.js / TypeScript API (JWT, RBAC, audit log)
        -> React dashboard (Leaflet map, Recharts)

## Tech stack

- **AI:** Python 3.11, Ultralytics YOLOv8n, ByteTrack, OpenCV, EasyOCR, a pretrained plate detector from Hugging Face
- **Pipeline:** Apache Kafka (KRaft), MongoDB 7, Redis 7, Docker Compose
- **Backend:** Node.js, TypeScript, Express, Mongoose, zod, JWT, bcrypt
- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, Leaflet, Recharts
- **Tests:** pytest, Vitest

## Quick start (tested on macOS, CPU only)

Prerequisites: Docker Desktop, Node.js, conda, Git.

1. Copy `.env.example` to `.env` and replace every `CHANGE_ME` value with your own secrets and passwords.
2. Create the Python environment: `conda create -n pravaah python=3.11 -y`, activate it, then `pip install -r ai-engine/requirements.txt -r stream/requirements.txt`.
3. Install and build: `npm install` then `npm run build:shared`.
4. Start everything: `./start_demo.sh` (Docker services, backend on port 4000, frontend on port 5173).
5. First time only: `npm run seed` (demo users, cameras, blacklist).
6. Generate fresh demo data: `npm run demo:reset` and type `RESET`.
7. Open http://localhost:5173
8. Stop with `./stop_demo.sh`.

The dashboard demo needs only the synthetic data from step 6. The datasets are needed only to run the AI engine on real images or video (see Data).

Never run `docker compose down -v` or `npm run infra:wipe-all-data`: they delete all stored data.

## Demo accounts

| Role | Email |
|---|---|
| Admin | admin@pravaah.local |
| Police | police@pravaah.local |
| Traffic Authority | traffic@pravaah.local |
| Analyst | analyst@pravaah.local |

Passwords are the `SEED_*_PASSWORD` values you set in `.env`.

## Tests

- Backend: `npm run test:backend`
- Stream processing: `PYTHONPATH=stream conda run -n pravaah pytest stream/tests/`
- AI engine: `PYTHONPATH=ai-engine conda run -n pravaah pytest ai-engine/tests/`

## Data

The datasets are not included. Download them from their providers, respect their licences, and place them in the git-ignored folders:

- CityFlowV2 (AI City Challenge 2022, Track 1) in `data/datasets/cityflow`
- Indian Number Plates (DataCluster Labs, Kaggle) in `data/datasets/indian_plates`

## Layout

`ai-engine/` camera worker, detectors, OCR, synthetic generator · `stream/` consumer, trajectories, alerts, analytics · `backend/` API · `frontend/` dashboard · `shared/` event schema and types · `infra/` Docker Compose and service config · `data/` camera network and seeds · `scripts/` demo reset

## Limitations and roadmap

- The camera network is simulated. CityFlow footage has unreadable plates, so video events carry an empty plate and are used only for counting and tracking.
- The plate detector is pretrained and OCR was checked only on a small sample. No accuracy figure is claimed.
- Planned: vehicle re-identification, OCR fine-tuning, corridor speed and origin-destination analytics, live push updates, report export, cloud deployment and real camera integration.
