# PRAVAAH (प्रवाह)
## AI-Powered City-Wide Vehicle Tracking, Multi-Camera ANPR Trajectory Reconstruction, and Urban Traffic Intelligence Platform
### Smart India Hackathon 2026 · Problem Statement 26127
**Comprehensive Engineering Project Documentation & Technical Report**

---

## 1. Metadata
- **Project Title:** PRAVAAH (प्रवाह)
- **Domain:** Smart Transportation, Computer Vision & Urban Security
- **Version:** v1.0.0 (Production Verified)
- **Date:** November 2026
- **Stack:** YOLOv8, ByteTrack, EasyOCR, Apache Kafka, MongoDB 7, Redis 7, Node.js/Express, TypeScript, React 18, Vite, Leaflet, Recharts

---

## 2. Abstract
PRAVAAH is a city-wide intelligent vehicle tracking, multi-camera ANPR trajectory reconstruction, and urban traffic intelligence platform developed for Smart India Hackathon 2026 (Problem Statement 26127). The system ingests high-throughput optical video streams across a simulated 10-camera Delhi/NCR intersection network, utilizing a decoupled edge-AI pipeline (YOLOv8 + ByteTrack + EasyOCR) connected via Apache Kafka to an analytical stream processor. The platform reconstructs cross-camera vehicle trajectories validated against a Floyd-Warshall road-network adjacency graph, flagging impossible travel speeds (> 120 km/h) to expose cloned license plates. Real-time security alerts cross-reference Redis-backed hotlists with automated 5-minute cooldown deduplication. A Node.js/TypeScript backend provides JWT authentication, four-tier RBAC, audit logging, and privacy-preserving plate masking (e.g. DL01****34) for civilian analysts. Operators interact through a tactical dark-mode web command center built with React 18, Leaflet, and Recharts.

---

## 3. Introduction
### 3.1 Background of Urban Transportation and City Surveillance
Metropolitan centers like Delhi/NCR face extreme traffic congestion, hit-and-run fatalities, and criminal mobility challenges. While CCTV cameras are widespread, they function as passive, disconnected silos requiring human operators to manually review tapes camera-by-camera.

### 3.2 Evolution of Automated Number Plate Recognition (ANPR)
Traditional ANPR systems rely on rigid OCR algorithms in controlled environments like toll plazas. In open-road conditions, non-uniform lighting and occlusions cause failures. Most critically, legacy ANPR cameras do not correlate sightings across city junctions.

### 3.3 The Need for Cross-Camera Trajectory Re-Identification
Individual sightings become actionable intelligence only when linked across space and time. Correlating sequential sightings enables travel-time estimation, physical velocity validation, and the detection of cloned plates or suspicious loitering loops.

---

## 4. Problem Statement
- **Camera Silos:** Disconnected local NVRs delay law enforcement response by days.
- **Cloned Plate Epidemic:** Fake plates cannot be detected by single cameras without cross-camera speed validation.
- **Sparse Network Tracking:** Vehicles disappear between camera blind spots separated by 1-5 km.
- **Congestion Blind Spots:** Municipalities lack real-time visibility into rolling corridor volume and vehicle classification mixes.
- **Privacy Compliance:** Surveillance data must be protected under India's Digital Personal Data Protection (DPDP) Act.

---

## 5. Objectives
1. Ingest 10 camera feeds in real time with YOLOv8, ByteTrack, and EasyOCR.
2. Build an event-driven streaming backbone with Apache Kafka.
3. Reconstruct cross-camera vehicle trajectories validated against an authoritative road graph.
4. Detect BLACKLIST_HIT, IMPOSSIBLE_TRAVEL (>120 km/h), and SUSPICIOUS_ROUTE anomalies.
5. Aggregate 5-minute rolling window traffic volumes and congestion indices.
6. Provide enterprise security with 4-tier RBAC, audit logging, and analyst plate masking.
7. Deliver a tactical GIS dark-mode web command center.

---

## 6. Proposed Solution
PRAVAAH models the city road network as a directed weighted spatiotemporal graph G = (V, E, W) using Floyd-Warshall shortest road distances. A five-tier architecture decouples Edge Perception, Message Streaming (Kafka), Stream Processing & Anomaly Inference, Polyglot Persistence (MongoDB + Redis), and Application/Presentation (Express + React).

---

## 7. Tools and Technologies Used
- **Ultralytics YOLOv8:** Multiclass vehicle detection (car, bike, bus, truck, auto).
- **ByteTrack:** Inter-frame object tracking within camera field of view.
- **EasyOCR + OpenCV:** CLAHE enhancement, bilateral filtering, character recognition, and multi-frame voting.
- **Apache Kafka (KRaft mode):** Fault-tolerant pub/sub message streaming across detections, alerts, and analytics.
- **MongoDB 7.0:** Durable document storage for detections, trajectories, alerts, traffic aggregates, and audit logs.
- **Redis 7.2:** Sub-millisecond hotlist set matching (SISMEMBER) and alert cooldown keys (SET NX EX 300).
- **Node.js & Express (TypeScript):** REST API with JWT authentication, RBAC, and Socket.IO real-time channels.
- **React 18 & Vite:** Single-page command center application.
- **Leaflet & React-Leaflet:** GIS interactive mapping with congestion markers and trajectory polylines.
- **Recharts:** Responsive traffic volume charts, hourly trends, and vehicle mix graphs.
- **Tailwind CSS:** Dark-slate control room UI system.

---

## 8. System Requirements
- **Development Workstation:** Quad-core CPU, 8-16 GB RAM, 20 GB SSD, Node.js 20+, Python 3.11, Docker & Docker Compose.
- **Edge Inference Node (per 2-4 cameras):** NVIDIA Jetson Orin Nano / NX with TensorRT acceleration.
- **Central Server:** 8-core CPU, 32-64 GB RAM, Enterprise NVMe SSD, 1 Gbps network interface.
- **Network Ports:** 4000 (Backend API), 5173 (Frontend), 9092/9094 (Kafka), 27017 (MongoDB), 6379 (Redis).

---

## 9. System Architecture & Delhi/NCR Camera Network
10 camera intersections mapped in data/cameras.json:
1. CAM_001: Connaught Place (Inner Circle) - Commercial
2. CAM_002: India Gate (Kartavya Path) - Restricted
3. CAM_003: ITO Chowk - Commercial
4. CAM_004: Kashmere Gate Metro - Transit
5. CAM_005: Anand Vihar ISBT - Transit
6. CAM_006: Lajpat Nagar - Commercial
7. CAM_007: Nehru Place - Commercial
8. CAM_008: Dwarka Sector 10 - Residential
9. CAM_009: Rohini Sector 15 - Residential
10. CAM_010: Noida Sector 18 - Commercial

---

## 10. Modules and Features
- **AI Perception Engine:** Frame decoding, YOLO detection, ByteTrack tracking, plate localization, CLAHE preprocessing, EasyOCR, and Indian plate regex validation.
- **Stream Processing Engine:** Schema validation, empty plate handling (has_plate: false), trajectory builder, Floyd-Warshall speed validation, alert engine with 5-minute Redis cooldown, and traffic volume aggregation.
- **Backend API & Security:** JWT auth, 4-tier RBAC (Admin, Police, TrafficAuthority, Analyst), audit logging, and analyst plate masking (DL01****34).
- **Frontend Command Center:** Interactive Leaflet map, live alerts drawer, traffic analytics charts, plate lookup, trajectory playback with bounds fitting, blacklist management, and audit viewer.

---

## 11. Detailed Working and Implementation
- **Detection Event Contract:** JSON schema enforcing UUID event_id, camera_id, ISO-8601 timestamp, plate_text, confidence, vehicle_type, bbox, and track_id.
- **Speed Physics Validation:** v = (distance / delta_t) * 3.6 km/h. If v > 120 km/h, flagged as IMPOSSIBLE_TRAVEL (cloned plate).
- **Alert Deduplication:** Redis key alert:cooldown:{type}:{plate} with 300s TTL.
- **Privacy Shield:** Analyst role strips snapshot_url and masks plate_text.
- **Audit Logging:** Logs all administrative actions and security denial telemetry (ACCESS_DENIED) upon HTTP 403.

---

## 12. User Interface Walkthrough & Screenshots
- **Figure 12.1:** Login Interface & Role-Based Gateway (docs/screenshots/01_login.png)
- **Figure 12.2:** Real-Time Tactical Command Center Map (docs/screenshots/02_command_center.png)
- **Figure 12.3:** Urban Traffic Analytics & Volume Charts (docs/screenshots/03_traffic_analytics.png)
- **Figure 12.4:** Automated Security Alerts Console (docs/screenshots/04_alerts_management.png)
- **Figure 12.5:** Alert Inspection Modal & Vehicle Snapshot (docs/screenshots/05_alert_details_modal.png)
- **Figure 12.6:** Low-Latency License Plate Search (docs/screenshots/06_plate_search.png)
- **Figure 12.7:** Spatiotemporal Trajectory Replay & Speed Check (docs/screenshots/07_trajectory_playback.png)
- **Figure 12.8:** Surveillance Blacklist & Hotlist Manager (docs/screenshots/08_blacklist_management.png)
- **Figure 12.9:** Forensic Security & Regulatory Audit Trail (docs/screenshots/09_audit_logs.png)

---

## 13. Usability and Target Users
- **Police Officers:** Incident response, plate search, trajectory tracking, blacklist additions.
- **Traffic Controllers:** Congestion monitoring, signal coordination, green corridors.
- **Urban Analysts:** Macro-mobility trends, modal split, privacy-protected analytics.
- **System Administrators:** User management, audit log reviews, system health.

---

## 14. Real-World Applications
- Counter-terrorism & VIP corridor protection.
- Stolen vehicle interception & amber alert tracking.
- Detection of cloned and fraudulent vehicle plates.
- Dynamic urban congestion management & emergency green corridors.

---

## 15. Advantages
- Decoupled, fault-tolerant microservices architecture.
- Mathematical physics validation eliminating false alarms.
- Sub-millisecond hotlist matching via Redis sets.
- Strict compliance with India's Digital Personal Data Protection Act.
- Runs on standard commodity hardware.

---

## 16. Limitations
- Optical camera degradation during extreme fog, heavy rain, or lens soiling.
- Custom non-standard fonts and physically defaced plates.
- Camera blind spots across unmonitored arterial segments.

---

## 17. Testing and Results
- **Backend API Tests:** 19/19 passed (Vitest) in 567 ms. Covers authentication, RBAC 403 audits, plate masking, and blacklist Redis sync.
- **Stream Processor Tests:** 14/14 passed (Pytest) in 0.16 s. Covers impossible travel speed math, blacklist cooldowns, and shuttle loops.
- **Frontend Typecheck:** 0 errors (tsc --noEmit).
- **Test Database Isolation:** All tests run on pravaah_test, leaving production demo database completely untouched.

---

## 18. Future Scope
- Multi-modal fusion with FASTag / RFID sensors.
- Edge AI acceleration using NVIDIA Jetson TensorRT INT8.
- Predictive congestion forecasting with Spatiotemporal Graph Neural Networks (ST-GNNs).
- Mobile patrol companion application for field police units.

---

## 19. Conclusion
PRAVAAH delivers a production-ready, mathematically sound, and privacy-compliant city-wide traffic intelligence platform. The system bridges edge computer vision and real-time streaming to empower law enforcement and urban mobility planners with actionable intelligence.

---

## 20. References
1. Ultralytics YOLOv8 Documentation (2023)
2. ByteTrack: Multi-Object Tracking by Associating Every Detection Box (ECCV 2022)
3. EasyOCR & CRAFT Text Detection (CVPR 2019)
4. Apache Kafka KRaft Documentation (2024)
5. MongoDB 7.0 Manual
6. Redis 7.2 Documentation
7. MoRTH High Security Registration Plates Guidelines (2019)
8. Digital Personal Data Protection (DPDP) Act (2023)
9. Cormen et al., Introduction to Algorithms (Floyd-Warshall Algorithm)
10. Smart India Hackathon 2026 Problem Statement 26127
