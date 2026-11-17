"""ai-engine/src/tracker.py
Tracking wrapper for PRAVAAH.
In video mode: Uses YOLOv8 ByteTrack tracking (persistent track_ids across frames).
In image mode: Monotonically increasing track_id counter per image.
"""

from __future__ import annotations

from typing import Optional

import numpy as np
from loguru import logger
from ultralytics import YOLO

from .detectors.vehicle_detector import COCO_VEHICLE_MAP, VehicleDetection


class VehicleTracker:
    def __init__(
        self,
        model_name_or_path: str = "yolov8n.pt",
        min_conf: float = 0.4,
    ) -> None:
        self.min_conf = min_conf
        logger.info(f"Initialising VehicleTracker with ByteTrack: model={model_name_or_path}")
        self.model = YOLO(model_name_or_path)
        self._image_mode_counter = 0

    def track_video_frame(self, frame: np.ndarray) -> list[VehicleDetection]:
        """
        Run YOLOv8 with ByteTrack tracking on a video frame.
        """
        results = self.model.track(
            source=frame,
            persist=True,
            tracker="bytetrack.yaml",
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

            # Retrieve ByteTrack ID
            track_id = int(box.id[0].item()) if box.id is not None else 0

            detections.append(
                VehicleDetection(
                    bbox=bbox,
                    vehicle_type=COCO_VEHICLE_MAP[cls_id],
                    confidence=conf,
                    track_id=track_id,
                )
            )

        return detections

    def detect_image_frame(self, frame: np.ndarray) -> list[VehicleDetection]:
        """
        Run detection without cross-frame tracking on an image frame.
        Assigns sequential track_id per detected vehicle.
        """
        results = self.model.predict(
            source=frame,
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

            self._image_mode_counter += 1
            detections.append(
                VehicleDetection(
                    bbox=bbox,
                    vehicle_type=COCO_VEHICLE_MAP[cls_id],
                    confidence=conf,
                    track_id=self._image_mode_counter,
                )
            )

        return detections
