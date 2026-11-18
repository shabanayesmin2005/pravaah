"""stream/tests/test_suspicious_route.py
Unit tests verifying the SUSPICIOUS_ROUTE alert trigger.
"""

from unittest.mock import MagicMock
from src.alert_engine import AlertEngine


def test_suspicious_route_shuttle_detection():
    mock_db = MagicMock()
    mock_redis = MagicMock()
    mock_producer = MagicMock()
    mock_redis.set.return_value = True  # cooldown check passes

    engine = AlertEngine(
        mongo_db=mock_db,
        redis_client=mock_redis,
        kafka_producer=mock_producer,
    )

    # Trajectory where vehicle shuttles between CAM_001 and CAM_002: A -> B -> A -> B
    trajectory = {
        "plate_text": "DL05ZZ9999",
        "waypoints": [
            {"camera_id": "CAM_001", "timestamp": "2026-11-17T10:00:00Z", "snapshot_url": "/s/1.jpg"},
            {"camera_id": "CAM_002", "timestamp": "2026-11-17T10:05:00Z", "snapshot_url": "/s/2.jpg"},
            {"camera_id": "CAM_001", "timestamp": "2026-11-17T10:10:00Z", "snapshot_url": "/s/3.jpg"},
            {"camera_id": "CAM_002", "timestamp": "2026-11-17T10:15:00Z", "snapshot_url": "/s/4.jpg"},
        ],
        "segments": [
            {"from_camera": "CAM_001", "to_camera": "CAM_002", "impossible_travel": False},
            {"from_camera": "CAM_002", "to_camera": "CAM_001", "impossible_travel": False},
            {"from_camera": "CAM_001", "to_camera": "CAM_002", "impossible_travel": False},
        ],
    }

    alerts = engine.evaluate_trajectory(trajectory)
    assert len(alerts) == 1
    alert = alerts[0]
    assert alert["type"] == "SUSPICIOUS_ROUTE"
    assert alert["plate_text"] == "DL05ZZ9999"
    assert alert["severity"] == "MEDIUM"
    assert "repeatedly shuttled between CAM_001 and CAM_002" in alert["description"]
    assert alert["camera_id"] == "CAM_002"


def test_normal_progressive_route_not_flagged():
    mock_db = MagicMock()
    mock_redis = MagicMock()
    mock_producer = MagicMock()

    engine = AlertEngine(
        mongo_db=mock_db,
        redis_client=mock_redis,
        kafka_producer=mock_producer,
    )

    # Normal progressive route: A -> B -> C -> D
    trajectory = {
        "plate_text": "DL01AB1234",
        "waypoints": [
            {"camera_id": "CAM_001", "timestamp": "2026-11-17T10:00:00Z"},
            {"camera_id": "CAM_003", "timestamp": "2026-11-17T10:08:00Z"},
            {"camera_id": "CAM_007", "timestamp": "2026-11-17T10:20:00Z"},
            {"camera_id": "CAM_010", "timestamp": "2026-11-17T10:30:00Z"},
        ],
        "segments": [],
    }

    alerts = engine.evaluate_trajectory(trajectory)
    assert len(alerts) == 0
