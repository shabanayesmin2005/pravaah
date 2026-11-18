"""stream/tests/test_empty_plate_rule.py
Unit tests verifying the critical rule:
Events with plate_text == "" (e.g. CityFlow video-source unreadable plates)
must be used for vehicle counting & traffic analytics, but must NEVER be used
for plate-based trajectory building or blacklist matching.
"""

from unittest.mock import MagicMock
from src.alert_engine import AlertEngine
from src.detection_consumer import DetectionConsumer
from src.trajectory_builder import TrajectoryBuilder


def test_empty_plate_never_blacklisted():
    mock_db = MagicMock()
    mock_redis = MagicMock()
    # Even if empty string somehow got into a set:
    mock_redis.sismember.return_value = True

    engine = AlertEngine(
        mongo_db=mock_db,
        redis_client=mock_redis,
        kafka_producer=MagicMock(),
    )

    # Empty string or whitespace must always return False
    assert engine.is_blacklisted("") is False
    assert engine.is_blacklisted("   ") is False


def test_empty_plate_detection_emits_no_alerts():
    engine = AlertEngine(
        mongo_db=MagicMock(),
        redis_client=MagicMock(),
        kafka_producer=MagicMock(),
    )
    detection = {
        "event_id": "test-unreadable-1",
        "camera_id": "CAM_001",
        "timestamp": "2026-11-17T10:00:00Z",
        "plate_text": "",
        "plate_confidence": 0.0,
        "vehicle_type": "truck",
    }
    alerts = engine.evaluate_detection(detection)
    assert len(alerts) == 0


def test_empty_plate_trajectory_ignored():
    builder = TrajectoryBuilder()
    assert builder.build_trajectory_for_plate("") is None
    assert builder.build_trajectory_for_plate("   ") is None


def test_empty_plate_stored_with_has_plate_flag():
    mock_db = MagicMock()
    mock_collection = MagicMock()
    mock_db.__getitem__.return_value = mock_collection

    consumer = DetectionConsumer(mongo_db=mock_db)

    event_empty_plate = {
        "event_id": "550e8400-e29b-41d4-a716-446655440000",
        "camera_id": "CAM_001",
        "timestamp": "2026-11-17T10:00:00Z",
        "plate_text": "",
        "plate_confidence": 0.0,
        "vehicle_type": "car",
        "bbox": [10.0, 20.0, 30.0, 40.0],
        "track_id": 1,
        "snapshot_url": "",
    }

    # Should validate and store successfully
    stored = consumer.store_event(event_empty_plate)
    assert stored is True

    # Verify update_one was called with has_plate=False
    call_args = mock_collection.update_one.call_args[0]
    update_doc = call_args[1]["$set"]
    assert update_doc["has_plate"] is False
    assert update_doc["plate_text"] == ""
