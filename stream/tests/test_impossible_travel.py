"""stream/tests/test_impossible_travel.py
Unit tests for speed calculation and IMPOSSIBLE_TRAVEL detection.
"""

import pytest
from src.trajectory_builder import TrajectoryBuilder, haversine_distance_m


def test_haversine_distance_accuracy():
    # Delhi Connaught Place (28.6315, 77.2167) to India Gate (28.6129, 77.2295)
    d = haversine_distance_m(28.6315, 77.2167, 28.6129, 77.2295)
    # Ground truth straight line distance is ~2.4 km (2390m)
    assert 2000 < d < 2600


def test_normal_speed_segment():
    builder = TrajectoryBuilder(max_speed_kmh=120.0)

    # CAM_001 to CAM_003: 2800 metres in 480 seconds = 5.83 m/s = 21.0 km/h
    wp1 = {"camera_id": "CAM_001", "timestamp": "2026-11-17T10:00:00Z"}
    wp2 = {"camera_id": "CAM_003", "timestamp": "2026-11-17T10:08:00Z"}

    seg = builder.calculate_segment(wp1, wp2)
    assert seg["impossible_travel"] is False
    assert 20.0 <= seg["implied_speed_kmh"] <= 22.0
    assert seg["distance_m"] == 2800.0


def test_impossible_travel_cloned_plate():
    builder = TrajectoryBuilder(max_speed_kmh=120.0)

    # CAM_001 to CAM_010: ~17.5 km road / 12.3 km haversine in 45 seconds = ~980-1400 km/h
    wp1 = {"camera_id": "CAM_001", "timestamp": "2026-11-17T10:00:00Z"}
    wp2 = {"camera_id": "CAM_010", "timestamp": "2026-11-17T10:00:45Z"}

    seg = builder.calculate_segment(wp1, wp2)
    assert seg["impossible_travel"] is True
    assert seg["implied_speed_kmh"] > 500.0  # massively exceeds 120 km/h limit


def test_zero_delta_time_different_cameras():
    builder = TrajectoryBuilder(max_speed_kmh=120.0)

    # Teleportation: different cameras at the identical timestamp
    wp1 = {"camera_id": "CAM_001", "timestamp": "2026-11-17T10:00:00Z"}
    wp2 = {"camera_id": "CAM_002", "timestamp": "2026-11-17T10:00:00Z"}

    seg = builder.calculate_segment(wp1, wp2)
    assert seg["impossible_travel"] is True
    assert seg["implied_speed_kmh"] >= 100000.0


def test_same_camera_normal_dwell():
    builder = TrajectoryBuilder(max_speed_kmh=120.0)

    # Same camera sighted 30 seconds later (e.g. traffic light queue)
    wp1 = {"camera_id": "CAM_001", "timestamp": "2026-11-17T10:00:00Z"}
    wp2 = {"camera_id": "CAM_001", "timestamp": "2026-11-17T10:00:30Z"}

    seg = builder.calculate_segment(wp1, wp2)
    assert seg["impossible_travel"] is False
    assert seg["distance_m"] == 0.0
    assert seg["implied_speed_kmh"] == 0.0
