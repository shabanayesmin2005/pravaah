"""ai-engine/synthetic/generator.py
Synthetic detection event generator for PRAVAAH.
Generates realistic detection events WITHOUT AI, respecting data/cameras.json
and its road-network adjacency graph.
Includes:
- Scripted planted vehicles (normal route, blacklist hit, impossible travel, night movement)
- Background random traffic (50 vehicles, realistic type mix, unreadable plates, realistic routes)
- Chronological ordering, speed multiplier, seed determinism
- Kafka publishing & demo_events.jsonl output
- Full JSON schema validation on every event
"""

from __future__ import annotations

import json
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Generator, Optional

from loguru import logger

from src.config import config
from src.kafka_publisher import KafkaPublisher
from src.models.detection import DetectionEvent, VehicleType
from src.validator import EventValidator
from .route_builder import CameraNetworkGraph

# Indian State RTO codes for synthetic background plates
STATE_CODES = ["DL", "MH", "KA", "UP", "HR", "GJ", "TN", "WB"]
VEHICLE_TYPES: list[VehicleType] = ["car", "bike", "bus", "truck", "auto"]
TYPE_WEIGHTS = [0.55, 0.25, 0.10, 0.07, 0.03]  # 55% car, 25% bike, 10% bus, 7% truck, 3% auto


class SyntheticEventGenerator:
    def __init__(
        self,
        seed: int = 42,
        speed: float = 1.0,
        base_time: Optional[datetime] = None,
        publisher: Optional[KafkaPublisher] = None,
        validator: Optional[EventValidator] = None,
        output_file: Optional[Path | str] = None,
    ) -> None:
        self.seed = seed
        self.speed = max(0.1, speed)
        self.rng = random.Random(seed)
        # Anchor base_time to ~60 minutes before run so events are fresh on demo day
        self.base_time = base_time or (datetime.now(timezone.utc) - timedelta(minutes=60))
        self.publisher = publisher
        self.validator = validator or EventValidator()
        self.output_file = Path(output_file or config.DEMO_EVENTS_PATH)
        self.graph = CameraNetworkGraph()

    def _generate_plate(self) -> str:
        """Generate a realistic Indian license plate e.g. DL01AB1234."""
        state = self.rng.choice(STATE_CODES)
        rto = f"{self.rng.randint(1, 99):02d}"
        series = "".join(self.rng.choices("ABCDEFGHJKLMNPQRSTUVWXYZ", k=2))
        number = f"{self.rng.randint(1, 9999):04d}"
        return f"{state}{rto}{series}{number}"

    def generate_all_events(self) -> list[DetectionEvent]:
        """
        Generate all planted scenario events, background traffic, and rush-hour surge,
        sorted chronologically.
        """
        all_events: list[DetectionEvent] = []

        # 1. Scripted Planted Vehicle Scenarios (Normal, Blacklist, Impossible Travel, Shuttle, Night)
        planted_events = self._generate_planted_scenarios()
        all_events.extend(planted_events)
        logger.info(f"Generated {len(planted_events)} events for scripted planted scenarios")

        # 2. Background Traffic (50 distinct vehicles)
        background_events = self._generate_background_traffic(count=50)
        all_events.extend(background_events)
        logger.info(f"Generated {len(background_events)} events for background traffic")

        # 3. Rush Hour Congestion Surge (60-80 vehicles passing CAM_001 & CAM_003 in a 5-minute window)
        rush_hour_events = self._generate_rush_hour_traffic()
        all_events.extend(rush_hour_events)
        logger.info(f"Generated {len(rush_hour_events)} events for rush hour scenario")

        # Sort all events chronologically
        all_events.sort(key=lambda e: e.timestamp)
        return all_events

    def _generate_planted_scenarios(self) -> list[DetectionEvent]:
        events: list[DetectionEvent] = []
        track_counter = 1000

        for sc in self.graph.demo_scenarios:
            sc_id = sc["scenario_id"]
            plate = sc["plate"]
            v_type: VehicleType = sc.get("vehicle_type", "car")
            waypoints = sc.get("waypoints", [])

            # All planted scenarios are relative to base_time in the last 60 minutes
            sc_base = self.base_time

            for wp in waypoints:
                cam_id = wp["camera_id"]
                offset_s = wp["offset_s"] / self.speed
                ts = sc_base + timedelta(seconds=offset_s)
                track_counter += 1

                # Generate bounding box
                bx1 = float(self.rng.randint(80, 200))
                by1 = float(self.rng.randint(100, 250))
                bx2 = float(bx1 + self.rng.randint(200, 350))
                by2 = float(by1 + self.rng.randint(150, 280))

                event = DetectionEvent(
                    camera_id=cam_id,
                    timestamp=ts.isoformat(),
                    plate_text=plate,
                    plate_confidence=round(self.rng.uniform(0.88, 0.96), 4),
                    vehicle_type=v_type,
                    bbox=[bx1, by1, bx2, by2],
                    track_id=track_counter,
                    snapshot_url=f"/snapshots/{cam_id}/{track_counter}_{ts.strftime('%Y%m%d_%H%M%S')}.jpg",
                    is_synthetic=True,
                    synthetic_scenario_id=sc_id,
                    plate_detector_method="model",
                )
                events.append(event)

        return events

    def _generate_rush_hour_traffic(self) -> list[DetectionEvent]:
        """
        Generate rush-hour congestion surge at CAM_001 and CAM_003 within a single 5-minute window
        (minutes 35 to 40 relative to base_time).
        ~75 vehicles total:
        - 48 vehicles traverse CAM_001 -> CAM_003
        - 26 vehicles pass CAM_001 only
        - 12 vehicles pass CAM_003 only
        Produces:
        CAM_001: 74 vehicles in 5 min -> Congestion index ~1.48 (Heavy)
        CAM_003: 60 vehicles in 5 min -> Congestion index ~1.20 (Moderate)
        """
        events: list[DetectionEvent] = []
        track_counter = 8000
        # 5-minute window starting at minute 35 of the 60-minute span
        window_start = self.base_time + timedelta(minutes=35)

        # 1. 48 vehicles traversing CAM_001 -> CAM_003
        for _ in range(48):
            plate = self._generate_plate()
            v_type: VehicleType = self.rng.choices(VEHICLE_TYPES, weights=TYPE_WEIGHTS)[0]
            t1_s = self.rng.uniform(5, 115) / self.speed
            ts1 = window_start + timedelta(seconds=t1_s)
            track_counter += 1

            bx1 = float(self.rng.randint(60, 250))
            by1 = float(self.rng.randint(90, 300))
            bx2 = float(bx1 + self.rng.randint(180, 350))
            by2 = float(by1 + self.rng.randint(140, 280))

            events.append(
                DetectionEvent(
                    camera_id="CAM_001",
                    timestamp=ts1.isoformat(),
                    plate_text=plate,
                    plate_confidence=round(self.rng.uniform(0.85, 0.95), 4),
                    vehicle_type=v_type,
                    bbox=[bx1, by1, bx2, by2],
                    track_id=track_counter,
                    snapshot_url=f"/snapshots/CAM_001/{track_counter}_{ts1.strftime('%Y%m%d_%H%M%S')}.jpg",
                    is_synthetic=True,
                    synthetic_scenario_id="RUSH_HOUR",
                    plate_detector_method="model",
                )
            )

            # Sighting 2 at CAM_003: travel time between 140s and 165s
            travel_s = self.rng.uniform(140, 165) / self.speed
            ts2 = ts1 + timedelta(seconds=travel_s)
            track_counter += 1

            events.append(
                DetectionEvent(
                    camera_id="CAM_003",
                    timestamp=ts2.isoformat(),
                    plate_text=plate,
                    plate_confidence=round(self.rng.uniform(0.85, 0.95), 4),
                    vehicle_type=v_type,
                    bbox=[bx1, by1, bx2, by2],
                    track_id=track_counter,
                    snapshot_url=f"/snapshots/CAM_003/{track_counter}_{ts2.strftime('%Y%m%d_%H%M%S')}.jpg",
                    is_synthetic=True,
                    synthetic_scenario_id="RUSH_HOUR",
                    plate_detector_method="model",
                )
            )

        # 2. 26 vehicles passing CAM_001 only (entering side roads / inner circle)
        for _ in range(26):
            plate = self._generate_plate()
            v_type: VehicleType = self.rng.choices(VEHICLE_TYPES, weights=TYPE_WEIGHTS)[0]
            t_s = self.rng.uniform(10, 290) / self.speed
            ts = window_start + timedelta(seconds=t_s)
            track_counter += 1

            bx1 = float(self.rng.randint(60, 250))
            by1 = float(self.rng.randint(90, 300))
            bx2 = float(bx1 + self.rng.randint(180, 350))
            by2 = float(by1 + self.rng.randint(140, 280))

            events.append(
                DetectionEvent(
                    camera_id="CAM_001",
                    timestamp=ts.isoformat(),
                    plate_text=plate,
                    plate_confidence=round(self.rng.uniform(0.85, 0.95), 4),
                    vehicle_type=v_type,
                    bbox=[bx1, by1, bx2, by2],
                    track_id=track_counter,
                    snapshot_url=f"/snapshots/CAM_001/{track_counter}_{ts.strftime('%Y%m%d_%H%M%S')}.jpg",
                    is_synthetic=True,
                    synthetic_scenario_id="RUSH_HOUR",
                    plate_detector_method="model",
                )
            )

        # 3. 12 vehicles passing CAM_003 only (cross-traffic from Tilak Bridge)
        for _ in range(12):
            plate = self._generate_plate()
            v_type: VehicleType = self.rng.choices(VEHICLE_TYPES, weights=TYPE_WEIGHTS)[0]
            t_s = self.rng.uniform(10, 290) / self.speed
            ts = window_start + timedelta(seconds=t_s)
            track_counter += 1

            bx1 = float(self.rng.randint(60, 250))
            by1 = float(self.rng.randint(90, 300))
            bx2 = float(bx1 + self.rng.randint(180, 350))
            by2 = float(by1 + self.rng.randint(140, 280))

            events.append(
                DetectionEvent(
                    camera_id="CAM_003",
                    timestamp=ts.isoformat(),
                    plate_text=plate,
                    plate_confidence=round(self.rng.uniform(0.85, 0.95), 4),
                    vehicle_type=v_type,
                    bbox=[bx1, by1, bx2, by2],
                    track_id=track_counter,
                    snapshot_url=f"/snapshots/CAM_003/{track_counter}_{ts.strftime('%Y%m%d_%H%M%S')}.jpg",
                    is_synthetic=True,
                    synthetic_scenario_id="RUSH_HOUR",
                    plate_detector_method="model",
                )
            )

        return events

    def _generate_background_traffic(self, count: int = 50) -> list[DetectionEvent]:
        events: list[DetectionEvent] = []
        track_counter = 5000

        for _ in range(count):
            plate = self._generate_plate()
            v_type: VehicleType = self.rng.choices(VEHICLE_TYPES, weights=TYPE_WEIGHTS)[0]
            # Random route of 2 to 4 camera hops
            route_len = self.rng.randint(2, 4)
            route = self.graph.generate_random_walk(self.rng, length=route_len)

            # Random start time within 60 minutes
            start_offset_s = self.rng.randint(0, 3600) / self.speed
            vehicle_start = self.base_time + timedelta(seconds=start_offset_s)

            elapsed_s = 0.0
            for cam_id, travel_from_prev_s in route:
                elapsed_s += (travel_from_prev_s / self.speed)
                ts = vehicle_start + timedelta(seconds=elapsed_s)
                track_counter += 1

                # 20% of background events have unreadable / low-confidence plates
                is_unreadable = self.rng.random() < 0.20
                if is_unreadable:
                    plate_text = ""
                    plate_conf = round(self.rng.uniform(0.20, 0.48), 4)
                else:
                    plate_text = plate
                    plate_conf = round(self.rng.uniform(0.82, 0.95), 4)

                bx1 = float(self.rng.randint(50, 300))
                by1 = float(self.rng.randint(80, 350))
                bx2 = float(bx1 + self.rng.randint(180, 400))
                by2 = float(by1 + self.rng.randint(140, 300))

                event = DetectionEvent(
                    camera_id=cam_id,
                    timestamp=ts.isoformat(),
                    plate_text=plate_text,
                    plate_confidence=plate_conf,
                    vehicle_type=v_type,
                    bbox=[bx1, by1, bx2, by2],
                    track_id=track_counter,
                    snapshot_url=f"/snapshots/{cam_id}/{track_counter}_{ts.strftime('%Y%m%d_%H%M%S')}.jpg",
                    is_synthetic=True,
                    synthetic_scenario_id="background",
                    plate_detector_method="model" if not is_unreadable else None,
                )
                events.append(event)

        return events

    def run(self, dry_run: bool = False) -> list[DetectionEvent]:
        """
        Generate events, validate against schema, save to jsonl, and publish.
        """
        events = self.generate_all_events()

        # Validate all events against schema
        invalid_count = 0
        for ev in events:
            ev_dict = ev.to_kafka_dict()
            if not self.validator.validate(ev_dict):
                invalid_count += 1

        if invalid_count > 0:
            raise ValueError(f"{invalid_count} generated events failed schema validation!")

        logger.info(f"All {len(events)} synthetic events passed schema validation ✓")

        # Write to JSONL file
        self.output_file.parent.mkdir(parents=True, exist_ok=True)
        with open(self.output_file, "w", encoding="utf-8") as f:
            for ev in events:
                f.write(json.dumps(ev.to_kafka_dict()) + "\n")
        logger.info(f"Saved {len(events)} events to {self.output_file}")

        # Publish to Kafka (or print in dry-run)
        if self.publisher is not None:
            published_count = 0
            for ev in events:
                if self.publisher.publish(ev):
                    published_count += 1
            self.publisher.flush()
            logger.info(f"Published {published_count} synthetic events (dry_run={dry_run})")

        return events
