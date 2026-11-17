"""ai-engine/src/models/detection.py
Pydantic v2 model that mirrors shared/schemas/detection.schema.json exactly.
Any field added to the schema MUST be reflected here and vice-versa.
"""

from __future__ import annotations

import uuid
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


VehicleType = Literal["car", "bike", "bus", "truck", "auto"]
ConfidenceTier = Literal["high", "medium", "low", "unreadable"]
PlateDetectorMethod = Literal["model", "heuristic"]


def _new_uuid() -> str:
    return str(uuid.uuid4())


class DetectionEvent(BaseModel):
    """
    One detection emitted to the Kafka 'detections' topic.
    Required fields mirror the JSON schema 'required' array.
    Optional fields are absent (not null) when not applicable.
    """

    # ── Required ──────────────────────────────────────────────────────────────
    event_id: str = Field(default_factory=_new_uuid)
    camera_id: str
    timestamp: str                       # ISO-8601 UTC
    plate_text: str = ""                 # "" when unreadable or OCR skipped
    plate_confidence: float = Field(ge=0.0, le=1.0, default=0.0)
    vehicle_type: VehicleType
    bbox: list[float]                    # [x1, y1, x2, y2] absolute pixels
    track_id: int = Field(ge=0)
    snapshot_url: str = ""

    # ── Optional — set by stream processors ──────────────────────────────────
    plate_format_invalid: Optional[bool] = None
    confidence_tier: Optional[ConfidenceTier] = None
    appearance_embedding: Optional[list[float]] = None

    # ── Optional — synthetic generator ───────────────────────────────────────
    is_synthetic: Optional[bool] = None
    synthetic_scenario_id: Optional[str] = None

    # ── Optional — plate detector provenance ─────────────────────────────────
    plate_detector_method: Optional[PlateDetectorMethod] = None

    model_config = {"extra": "forbid"}

    @field_validator("plate_confidence")
    @classmethod
    def _confidence_in_range(cls, v: float) -> float:
        if not 0.0 <= v <= 1.0:
            raise ValueError(f"plate_confidence must be 0.0–1.0, got {v}")
        return round(v, 4)

    @model_validator(mode="after")
    def _heuristic_confidence_cap(self) -> "DetectionEvent":
        """Heuristic events must never exceed confidence 0.49."""
        if self.plate_detector_method == "heuristic" and self.plate_confidence > 0.49:
            object.__setattr__(self, "plate_confidence", 0.49)
        return self

    def to_kafka_dict(self) -> dict:
        """Serialise for Kafka/JSONL, excluding None optional fields."""
        d = self.model_dump(exclude_none=True)
        if "bbox" in d and isinstance(d["bbox"], (tuple, list)):
            d["bbox"] = list(d["bbox"])
        return d
