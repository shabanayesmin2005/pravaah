"""ai-engine/synthetic/route_builder.py
Loads the camera road-network adjacency graph from data/cameras.json.
Provides path generation, edge lookup, and travel-time validation.
"""

from __future__ import annotations

import json
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from loguru import logger

from src.config import config


@dataclass
class Edge:
    from_cam: str
    to_cam: str
    road_name: str
    distance_m: int
    min_travel_s: int
    max_travel_s: int


class CameraNetworkGraph:
    def __init__(self, cameras_json_path: Optional[Path | str] = None) -> None:
        p = Path(cameras_json_path or config.CAMERAS_JSON_PATH)
        if not p.exists():
            raise FileNotFoundError(f"cameras.json not found at {p}")

        with open(p, "r", encoding="utf-8") as f:
            data = json.load(f)

        self.cameras: list[dict] = data.get("cameras", [])
        self.camera_ids: list[str] = [c["id"] for c in self.cameras]
        self.demo_scenarios: list[dict] = data.get("demo_scenarios", {}).get("routes", [])

        # Build adjacency maps: from_cam -> {to_cam -> Edge}
        self.adj: dict[str, dict[str, Edge]] = {cid: {} for cid in self.camera_ids}
        for e in data.get("adjacency_graph", {}).get("edges", []):
            edge = Edge(
                from_cam=e["from"],
                to_cam=e["to"],
                road_name=e.get("road_name", ""),
                distance_m=e.get("distance_m", 1000),
                min_travel_s=e.get("min_travel_s", 60),
                max_travel_s=e.get("max_travel_s", 600),
            )
            if edge.from_cam in self.adj:
                self.adj[edge.from_cam][edge.to_cam] = edge

        logger.info(
            f"Loaded CameraNetworkGraph: {len(self.camera_ids)} cameras, "
            f"{sum(len(neighbors) for neighbors in self.adj.values())} directed edges"
        )

    def get_edge(self, from_cam: str, to_cam: str) -> Optional[Edge]:
        return self.adj.get(from_cam, {}).get(to_cam)

    def generate_random_walk(self, rng: random.Random, length: int = 3) -> list[tuple[str, int]]:
        """
        Generate a connected route of cameras (camera_id, travel_time_from_prev_s).
        Returns list of (camera_id, delta_seconds_from_previous_camera).
        First camera has delta=0.
        Prevents A->B->A->B oscillation pattern so SUSPICIOUS_ROUTE is reserved for planted scenarios.
        """
        start_cam = rng.choice(self.camera_ids)
        route: list[tuple[str, int]] = [(start_cam, 0)]
        curr_cam = start_cam

        for _ in range(length - 1):
            neighbors = list(self.adj.get(curr_cam, {}).keys())
            if not neighbors:
                break

            # Prevent A->B->A->B oscillation: if route ends in X -> Y -> X, candidate must not be Y
            if len(route) >= 3 and route[-1][0] == route[-3][0]:
                forbidden_cam = route[-2][0]
                candidates = [c for c in neighbors if c != forbidden_cam]
                if candidates:
                    neighbors = candidates
                else:
                    break

            next_cam = rng.choice(neighbors)
            edge = self.adj[curr_cam][next_cam]

            # Choose realistic travel time between min_travel_s and average/capped travel time
            travel_s = rng.randint(edge.min_travel_s + 10, min(edge.min_travel_s + 90, edge.max_travel_s))
            route.append((next_cam, travel_s))
            curr_cam = next_cam

        return route
