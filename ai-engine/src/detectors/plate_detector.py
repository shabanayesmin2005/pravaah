"""ai-engine/src/detectors/plate_detector.py
License plate detector for PRAVAAH.
Primary: yasirfaizahmed/license-plate-object-detection (YOLOv8 nano).
Heuristic fallback: OFF by default. If model loading fails, exits with code 1
unless allow_heuristic_fallback=True is explicitly passed.
"""

from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import numpy as np
from loguru import logger
from ultralytics import YOLO

from ..models.detection import PlateDetectorMethod

# Ensure YOLO has from_pretrained support for HuggingFace Hub repos
if not hasattr(YOLO, "from_pretrained"):
    @classmethod
    def _from_pretrained(cls, repo_id: str, filename: str = "best.pt", **kwargs):
        from huggingface_hub import hf_hub_download
        weight_path = hf_hub_download(repo_id=repo_id, filename=filename)
        return cls(weight_path, **kwargs)

    YOLO.from_pretrained = _from_pretrained  # type: ignore[attr-defined]


@dataclass
class PlateDetection:
    # Plate bounding box in original frame pixel coordinates: (x1, y1, x2, y2)
    bbox: tuple[float, float, float, float]
    # Cropped plate image (BGR)
    plate_img: np.ndarray
    confidence: float
    method: PlateDetectorMethod


class PlateDetector:
    def __init__(
        self,
        model_name_or_path: str = "yasirfaizahmed/license-plate-object-detection",
        allow_heuristic_fallback: bool = False,
        min_conf: float = 0.35,
    ) -> None:
        self.allow_heuristic_fallback = allow_heuristic_fallback
        self.min_conf = min_conf
        self.model: Optional[YOLO] = None
        self.using_heuristic = False

        logger.info(
            f"Initialising PlateDetector: model={model_name_or_path}, allow_heuristic={allow_heuristic_fallback}"
        )
        try:
            if "/" in model_name_or_path and not Path(model_name_or_path).exists():
                self.model = YOLO.from_pretrained(model_name_or_path)
            else:
                self.model = YOLO(model_name_or_path)
            logger.info("Plate detector model loaded successfully.")
        except Exception as exc:
            if not self.allow_heuristic_fallback:
                logger.error(
                    f"\n[FATAL] Plate detector model could not be loaded: {exc}\n"
                    f"        Re-run with --allow-heuristic-fallback to use the bottom-crop heuristic instead.\n"
                    f"        Exit code 1."
                )
                sys.exit(1)
            else:
                logger.warning(
                    f"Plate detector model load failed ({exc}). "
                    f"Proceeding with heuristic bottom-crop fallback (--allow-heuristic-fallback active)."
                )
                self.using_heuristic = True

    def detect_in_vehicle(
        self,
        frame: np.ndarray,
        vehicle_bbox: tuple[float, float, float, float],
    ) -> Optional[PlateDetection]:
        """
        Detect license plate within a vehicle bounding box.
        vehicle_bbox is (vx1, vy1, vx2, vy2) in absolute frame coordinates.
        """
        h_frame, w_frame = frame.shape[:2]
        vx1, vy1, vx2, vy2 = [int(round(c)) for c in vehicle_bbox]
        vx1, vy1 = max(0, vx1), max(0, vy1)
        vx2, vy2 = min(w_frame, vx2), min(h_frame, vy2)

        vw = vx2 - vx1
        vh = vy2 - vy1
        if vw <= 10 or vh <= 10:
            return None

        vehicle_crop = frame[vy1:vy2, vx1:vx2]

        if self.using_heuristic or self.model is None:
            # Heuristic bottom-center crop: bottom 30% height x middle 60% width
            crop_h = int(vh * 0.30)
            crop_w = int(vw * 0.60)
            px1_rel = (vw - crop_w) // 2
            px2_rel = px1_rel + crop_w
            py1_rel = vh - crop_h
            py2_rel = vh

            plate_img = vehicle_crop[py1_rel:py2_rel, px1_rel:px2_rel]
            if plate_img.size == 0:
                return None

            abs_bbox = (
                float(vx1 + px1_rel),
                float(vy1 + py1_rel),
                float(vx1 + px2_rel),
                float(vy1 + py2_rel),
            )
            # Heuristic events hard-capped at 0.49
            return PlateDetection(
                bbox=abs_bbox,
                plate_img=plate_img,
                confidence=0.45,
                method="heuristic",
            )

        # Run model inference on vehicle crop
        try:
            results = self.model.predict(
                source=vehicle_crop,
                conf=self.min_conf,
                device="cpu",
                verbose=False,
            )
        except Exception as exc:
            logger.warning(f"Plate detection inference failed: {exc}")
            return None

        if not results:
            return None

        boxes = results[0].boxes
        if boxes is None or len(boxes) == 0:
            return None

        # Pick the detection with the highest confidence
        best_box = max(boxes, key=lambda b: float(b.conf[0].item()))
        conf = float(best_box.conf[0].item())
        xyxy = best_box.xyxy[0].tolist()
        px1_rel, py1_rel, px2_rel, py2_rel = [int(round(c)) for c in xyxy]

        px1_rel, py1_rel = max(0, px1_rel), max(0, py1_rel)
        px2_rel, py2_rel = min(vw, px2_rel), min(vh, py2_rel)

        plate_img = vehicle_crop[py1_rel:py2_rel, px1_rel:px2_rel]
        if plate_img.size == 0:
            return None

        abs_bbox = (
            float(vx1 + px1_rel),
            float(vy1 + py1_rel),
            float(vx1 + px2_rel),
            float(vy1 + py2_rel),
        )

        return PlateDetection(
            bbox=abs_bbox,
            plate_img=plate_img,
            confidence=min(0.99, conf),
            method="model",
        )
