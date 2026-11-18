"""stream/tests/test_blacklist_alert.py
Unit tests for blacklist matching and cooldown deduplication.
"""

from unittest.mock import MagicMock
import pytest
from src.alert_engine import AlertEngine


@pytest.fixture
def mock_alert_engine():
    """Create AlertEngine with mocked MongoDB, Redis, and Kafka."""
    mock_db = MagicMock()
    mock_redis = MagicMock()
    mock_producer = MagicMock()

    # In-memory dict and set for mock redis
    redis_sets = {"blacklist:plates": {"MH12CD5678", "DL09XY0023"}}
    redis_keys = {}

    def sismember(sname, val):
        return val in redis_sets.get(sname, set())

    def rset(name, val, ex=None, nx=False):
        if nx and name in redis_keys:
            return None  # key exists, nx fails
        redis_keys[name] = val
        return True

    mock_redis.sismember.side_effect = sismember
    mock_redis.set.side_effect = rset
    mock_redis.hget.return_value = '{"reason": "Hit and run", "severity": "HIGH", "agency": "Police"}'

    engine = AlertEngine(
        mongo_db=mock_db,
        redis_client=mock_redis,
        kafka_producer=mock_producer,
        cooldown_seconds=300,
    )
    return engine


def test_blacklist_match(mock_alert_engine):
    assert mock_alert_engine.is_blacklisted("MH12CD5678") is True
    assert mock_alert_engine.is_blacklisted("DL09XY0023") is True
    assert mock_alert_engine.is_blacklisted("DL01AB1234") is False


def test_blacklist_alert_emission(mock_alert_engine):
    detection = {
        "event_id": "test-uuid-1",
        "camera_id": "CAM_002",
        "timestamp": "2026-11-17T10:00:00Z",
        "plate_text": "MH12CD5678",
        "snapshot_url": "/snapshots/CAM_002/1005.jpg",
    }
    alerts = mock_alert_engine.evaluate_detection(detection)
    assert len(alerts) == 1
    assert alerts[0]["type"] == "BLACKLIST_HIT"
    assert alerts[0]["plate_text"] == "MH12CD5678"
    assert alerts[0]["severity"] == "HIGH"


def test_cooldown_deduplication(mock_alert_engine):
    detection = {
        "event_id": "test-uuid-1",
        "camera_id": "CAM_002",
        "timestamp": "2026-11-17T10:00:00Z",
        "plate_text": "MH12CD5678",
        "snapshot_url": "/snapshots/CAM_002/1005.jpg",
    }
    # 1. First sighting: alert emitted
    first_alerts = mock_alert_engine.evaluate_detection(detection)
    assert len(first_alerts) == 1

    # 2. Second sighting immediately after: suppressed by cooldown!
    second_alerts = mock_alert_engine.evaluate_detection(detection)
    assert len(second_alerts) == 0
