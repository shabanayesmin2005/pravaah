"""stream/src/trajectory_builder.py
Builds and updates vehicle trajectories from chronologically ordered camera visits.
Validates consecutive segments against the camera network distance graph
and flags IMPOSSIBLE_TRAVEL when implied speed exceeds max_speed_kmh.
NOTE: Events with plate_text == "" are STRICTLY excluded from trajectory building.
"""

from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import dateutil.parser
from loguru import logger
import pymongo
from pymongo.collection import Collection
from pymongo.database import Database

from .config import config


def haversine_distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate great-circle distance between two GPS coordinates in metres."""
    r = 6371000.0  # Earth radius in metres
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return r * c


class TrajectoryBuilder:
    def __init__(
        self,
        mongo_db: Optional[Database] = None,
        cameras_json_path: Optional[Path | str] = None,
        max_speed_kmh: Optional[float] = None,
    ) -> None:
        if mongo_db is not None:
            self.db = mongo_db
        else:
            client = pymongo.MongoClient(config.MONGO_URI, serverSelectionTimeoutMS=5000)
            self.db = client[config.MONGO_DB_NAME]

        self.detections_col: Collection = self.db["detections"]
        self.trajectories_col: Collection = self.db["trajectories"]
        self.max_speed_kmh = max_speed_kmh or config.MAX_SPEED_KMH

        self.ensure_indexes()
        self._load_camera_network(cameras_json_path or config.CAMERAS_JSON_PATH)

    def ensure_indexes(self) -> None:
        try:
            self.trajectories_col.create_index("plate_text", unique=True)
            self.trajectories_col.create_index("impossible_travel")
            self.trajectories_col.create_index("last_seen")
        except Exception as exc:
            logger.warning(f"Could not create indexes on 'trajectories': {exc}")

    def _load_camera_network(self, p: Path | str) -> None:
        """Load camera coordinates and build shortest path road distance matrix."""
        path = Path(p)
        if not path.exists():
            raise FileNotFoundError(f"Camera network config not found at {path}")

        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        self.cameras: dict[str, dict[str, Any]] = {c["id"]: c for c in data.get("cameras", [])}
        edges = data.get("adjacency_graph", {}).get("edges", [])

        # Floyd-Warshall all-pairs shortest paths
        inf = float("inf")
        cam_ids = list(self.cameras.keys())
        self.dist_matrix: dict[str, dict[str, float]] = {c1: {c2: inf for c2 in cam_ids} for c1 in cam_ids}
        for cid in cam_ids:
            self.dist_matrix[cid][cid] = 0.0

        for e in edges:
            u, v, d = e["from"], e["to"], float(e["distance_m"])
            if u in self.dist_matrix and v in self.dist_matrix[u]:
                self.dist_matrix[u][v] = min(self.dist_matrix[u][v], d)

        for k in cam_ids:
            for i in cam_ids:
                for j in cam_ids:
                    if self.dist_matrix[i][k] + self.dist_matrix[k][j] < self.dist_matrix[i][j]:
                        self.dist_matrix[i][j] = self.dist_matrix[i][k] + self.dist_matrix[k][j]

        logger.info(
            f"Loaded camera network: {len(self.cameras)} cameras. "
            f"Shortest path distance matrix computed ✓"
        )

    def get_distance_m(self, from_cam: str, to_cam: str) -> float:
        """
        Get distance between two cameras in metres.
        Prefers graph road distance; falls back to straight-line Haversine.
        """
        if from_cam == to_cam:
            return 0.0

        graph_d = self.dist_matrix.get(from_cam, {}).get(to_cam, float("inf"))
        if graph_d < float("inf"):
            return graph_d

        # Fallback to Haversine straight-line distance
        c1 = self.cameras.get(from_cam)
        c2 = self.cameras.get(to_cam)
        if c1 and c2:
            loc1 = c1["location"]
            loc2 = c2["location"]
            return haversine_distance_m(loc1["lat"], loc1["lng"], loc2["lat"], loc2["lng"])

        return 1000.0  # generic fallback 1km

    def calculate_segment(
        self, prev_wp: dict[str, Any], curr_wp: dict[str, Any]
    ) -> dict[str, Any]:
        """Compute travel metrics between two consecutive waypoints."""
        from_cam = prev_wp["camera_id"]
        to_cam = curr_wp["camera_id"]

        t1 = dateutil.parser.isoparse(prev_wp["timestamp"]).timestamp()
        t2 = dateutil.parser.isoparse(curr_wp["timestamp"]).timestamp()
        delta_s = max(0.0, t2 - t1)

        dist_m = self.get_distance_m(from_cam, to_cam)

        if from_cam == to_cam:
            speed_kmh = 0.0
            is_impossible = False
        elif delta_s <= 0.0:
            # Different cameras at the exact same instant -> teleportation / clone
            speed_kmh = 999999.0
            is_impossible = True
        else:
            speed_kmh = round((dist_m / delta_s) * 3.6, 2)
            is_impossible = speed_kmh > self.max_speed_kmh

        return {
            "from_camera": from_cam,
            "to_camera": to_cam,
            "distance_m": round(dist_m, 1),
            "delta_time_s": round(delta_s, 2),
            "implied_speed_kmh": speed_kmh,
            "impossible_travel": is_impossible,
        }

    def build_trajectory_for_plate(self, plate_text: str) -> Optional[dict[str, Any]]:
        """
        Reconstruct the full trajectory for a single plate from stored detections.
        Ignores empty plate strings.
        """
        clean_plate = plate_text.strip()
        if not clean_plate:
            return None

        # Fetch all detections for plate, sorted chronologically
        cursor = self.detections_col.find(
            {"plate_text": clean_plate},
            sort=[("timestamp", pymongo.ASCENDING)],
        )
        detections = list(cursor)
        if not detections:
            return None

        waypoints: list[dict[str, Any]] = []
        segments: list[dict[str, Any]] = []
        has_impossible = False
        total_dist_m = 0.0

        for d in detections:
            wp = {
                "camera_id": d["camera_id"],
                "timestamp": d["timestamp"],
                "snapshot_url": d.get("snapshot_url", ""),
                "track_id": d.get("track_id", 0),
                "confidence": d.get("plate_confidence", 0.0),
                "vehicle_type": d.get("vehicle_type", "car"),
            }
            if waypoints:
                seg = self.calculate_segment(waypoints[-1], wp)
                segments.append(seg)
                total_dist_m += seg["distance_m"]
                if seg["impossible_travel"]:
                    has_impossible = True
            waypoints.append(wp)

        t_first = dateutil.parser.isoparse(waypoints[0]["timestamp"]).timestamp()
        t_last = dateutil.parser.isoparse(waypoints[-1]["timestamp"]).timestamp()
        total_duration_s = max(0.0, t_last - t_first)

        trajectory_doc = {
            "plate_text": clean_plate,
            "vehicle_type": waypoints[-1]["vehicle_type"],
            "waypoints": waypoints,
            "segments": segments,
            "impossible_travel": has_impossible,
            "total_distance_m": round(total_dist_m, 1),
            "total_duration_s": round(total_duration_s, 1),
            "first_seen": waypoints[0]["timestamp"],
            "last_seen": waypoints[-1]["timestamp"],
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        # Save to database
        self.trajectories_col.update_one(
            {"plate_text": clean_plate},
            {"$set": trajectory_doc},
            upsert=True,
        )

        return trajectory_doc

    def build_all_trajectories(self) -> list[dict[str, Any]]:
        """Batch build trajectories for all distinct non-empty plates."""
        distinct_plates = self.detections_col.distinct(
            "plate_text",
            {"plate_text": {"$nin": ["", None]}},
        )
        logger.info(f"Building trajectories for {len(distinct_plates)} distinct plates...")

        results: list[dict[str, Any]] = []
        impossible_count = 0

        for plate in distinct_plates:
            traj = self.build_trajectory_for_plate(plate)
            if traj is not None:
                results.append(traj)
                if traj["impossible_travel"]:
                    impossible_count += 1
                    logger.warning(
                        f"[TRAJECTORY] IMPOSSIBLE_TRAVEL detected | plate={plate} | "
                        f"segments={len(traj['segments'])}"
                    )
                else:
                    logger.info(
                        f"[TRAJECTORY] Built trajectory | plate={plate} | "
                        f"hops={len(traj['waypoints'])} | dist={traj['total_distance_m']}m"
                    )

        logger.info(
            f"Finished building {len(results)} trajectories "
            f"({impossible_count} flagged as impossible travel)"
        )
        return results
