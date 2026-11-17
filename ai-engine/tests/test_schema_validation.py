"""ai-engine/tests/test_schema_validation.py
Unit tests verifying DetectionEvent models and JSON schema validation.
"""

import pytest
import jsonschema
from pydantic import ValidationError

from src.models.detection import DetectionEvent
from src.validator import EventValidator


@pytest.fixture
def validator():
    return EventValidator()


def test_valid_detection_event(validator):
    ev = DetectionEvent(
        camera_id="CAM_001",
        timestamp="2026-11-16T12:00:00Z",
        plate_text="DL01AB1234",
        plate_confidence=0.92,
        vehicle_type="car",
        bbox=[120.0, 45.0, 380.0, 210.0],
        track_id=57,
        snapshot_url="/snapshots/CAM_001/57_20261116_120000.jpg",
    )
    ev_dict = ev.to_kafka_dict()
    assert validator.validate(ev_dict) is True


def test_cityflow_unreadable_event(validator):
    """CityFlow rule: plate_text='', plate_confidence=0.0, plate_detector_method not set."""
    ev = DetectionEvent(
        camera_id="CAM_001",
        timestamp="2026-11-16T12:00:00Z",
        plate_text="",
        plate_confidence=0.0,
        vehicle_type="truck",
        bbox=[50.0, 60.0, 400.0, 350.0],
        track_id=12,
        snapshot_url="/snapshots/CAM_001/12_20261116_120000.jpg",
    )
    ev_dict = ev.to_kafka_dict()
    assert validator.validate(ev_dict) is True


def test_heuristic_event_confidence_cap(validator):
    """Heuristic events must cap confidence at 0.49 and set plate_detector_method='heuristic'."""
    ev = DetectionEvent(
        camera_id="CAM_006",
        timestamp="2026-11-16T12:00:00Z",
        plate_text="MH12CD5678",
        plate_confidence=0.85,  # Model validator will cap this at 0.49
        vehicle_type="car",
        bbox=[100.0, 100.0, 300.0, 300.0],
        track_id=8,
        snapshot_url="/snapshots/CAM_006/8_20261116_120000.jpg",
        plate_detector_method="heuristic",
    )
    assert ev.plate_confidence == 0.49
    ev_dict = ev.to_kafka_dict()
    assert validator.validate(ev_dict) is True


def test_synthetic_event_fields(validator):
    """Synthetic events must have is_synthetic=True and optional scenario ID."""
    ev = DetectionEvent(
        camera_id="CAM_002",
        timestamp="2026-11-16T12:00:00Z",
        plate_text="MH12CD5678",
        plate_confidence=0.91,
        vehicle_type="car",
        bbox=[120.0, 45.0, 380.0, 210.0],
        track_id=101,
        snapshot_url="/snapshots/CAM_002/101_20261116_120000.jpg",
        is_synthetic=True,
        synthetic_scenario_id="BLACKLIST_HIT",
    )
    ev_dict = ev.to_kafka_dict()
    assert validator.validate(ev_dict) is True


def test_missing_required_field(validator):
    """Missing a required field like track_id must fail schema validation."""
    invalid_dict = {
        "event_id": "550e8400-e29b-41d4-a716-446655440000",
        "camera_id": "CAM_001",
        "timestamp": "2026-11-16T12:00:00Z",
        "plate_text": "DL01AB1234",
        "plate_confidence": 0.9,
        "vehicle_type": "car",
        "bbox": [10, 20, 30, 40],
        # track_id is missing!
        "snapshot_url": "",
    }
    assert validator.validate(invalid_dict) is False


def test_invalid_vehicle_type(validator):
    """An unsupported vehicle class must fail schema validation."""
    invalid_dict = {
        "event_id": "550e8400-e29b-41d4-a716-446655440000",
        "camera_id": "CAM_001",
        "timestamp": "2026-11-16T12:00:00Z",
        "plate_text": "DL01AB1234",
        "plate_confidence": 0.9,
        "vehicle_type": "airplane",  # Invalid enum!
        "bbox": [10, 20, 30, 40],
        "track_id": 1,
        "snapshot_url": "",
    }
    assert validator.validate(invalid_dict) is False


def test_extra_forbidden_properties(validator):
    """additionalProperties: false must reject unknown fields."""
    invalid_dict = {
        "event_id": "550e8400-e29b-41d4-a716-446655440000",
        "camera_id": "CAM_001",
        "timestamp": "2026-11-16T12:00:00Z",
        "plate_text": "DL01AB1234",
        "plate_confidence": 0.9,
        "vehicle_type": "car",
        "bbox": [10, 20, 30, 40],
        "track_id": 1,
        "snapshot_url": "",
        "random_extra_property": "not_allowed",
    }
    assert validator.validate(invalid_dict) is False
