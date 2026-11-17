"""ai-engine/src/detectors/vehicle_detector.py
Vehicle detection using pretrained YOLOv8n (COCO).
Maps COCO vehicle classes to PRAVAAH VehicleType taxonomy.
Runs on CPU.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import numpy as np
from loguru import logger
from ultralytics import YOLO

from ..models.detection import VehicleType

# COCO class IDs for vehicles:
# 2: car, 3: motorcycle, 5: bus, 7: truck
COCO_VEHICLE_MAP: dict[int, VehicleType] = {
    2: "car",
    3: "bike",
    5: "bus",
    7: "truck",
}


@dataclass
class VehicleDetection:
    bbox: tuple[float, float, float, float]  # (x1, y1, x2, y2) in absolute pixel coordinates
    vehicle_type: VehicleType
    confidence: float
    track_id: Optional[int] = None


class VehicleDetector:
    def __init__(self, model_name_or_path: str = "yolov8n.pt", min_conf: float = 0.4) -> None:
        self.min_conf = min_conf
        logger.info(f"Loading vehicle detector model: {model_name_or_path} (device=cpu)")
        self.model = YOLO(model_name_or_path)

    def detect(self, image: np.ndarray) -> list[VehicleDetection]:
        """
        Run vehicle detection on a single BGR image.
        """
        results = self.model.predict(
            source=image,
            conf=self.min_conf,
            classes=list(COCO_VEHICLE_MAP.keys()),
            device="cpu",
            verbose=False,
        )

        detections: list[VehicleDetection] = []
        if not results:
            return detections

        r = results[0]
        boxes = r.boxes
        if boxes is None or len(boxes) == 0:
            return detections

        for box in boxes:
            cls_id = int(box.cls[0].item())
            if cls_id not in COCO_VEHICLE_MAP:
                continue

            conf = float(box.conf[0].item())
            xyxy = box.xyxy[0].tolist()
            bbox = (round(xyxy[0], 2), round(xyxy[1], 2), round(xyxy[2], 2), round(xyxy[3], 2))

            detections.append(
                VehicleDetection(
                    bbox=bbox,
                    vehicle_type=COCO_VEHICLE_MAP[cls_id],
                    confidence=conf,
                    track_id=None,
                )
            )

        return detections
