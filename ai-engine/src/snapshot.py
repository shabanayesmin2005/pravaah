"""ai-engine/src/snapshot.py
Vehicle snapshot saver.
Crops detected vehicle bounding box and saves to JPEG on disk.
Returns relative URL served by backend: /snapshots/<camera_id>/<filename>.jpg
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
from loguru import logger

from .config import config


class SnapshotManager:
    def __init__(self, base_dir: Optional[Path] = None) -> None:
        self.base_dir = Path(base_dir or config.SNAPSHOT_DIR)

    def save_vehicle_crop(
        self,
        frame: np.ndarray,
        bbox: tuple[float, float, float, float],
        camera_id: str,
        track_id: int,
        timestamp: Optional[datetime] = None,
        dry_run: bool = False,
    ) -> str:
        """
        Crop vehicle from frame and save as JPEG.
        Returns relative URL e.g. /snapshots/CAM_001/57_20261116_132045.jpg
        """
        ts = timestamp or datetime.now(timezone.utc)
        ts_str = ts.strftime("%Y%m%d_%H%M%S_%f")[:19]  # up to milliseconds
        filename = f"{track_id}_{ts_str}.jpg"
        relative_url = f"/snapshots/{camera_id}/{filename}"

        if dry_run:
            # In dry-run mode, return format without requiring disk write
            return relative_url

        try:
            h_frame, w_frame = frame.shape[:2]
            x1, y1, x2, y2 = [int(round(c)) for c in bbox]
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(w_frame, x2), min(h_frame, y2)

            crop = frame[y1:y2, x1:x2]
            if crop.size == 0:
                return ""

            cam_dir = self.base_dir / camera_id
            cam_dir.mkdir(parents=True, exist_ok=True)
            out_path = cam_dir / filename

            # Write JPEG with quality 85
            cv2.imwrite(str(out_path), crop, [cv2.IMWRITE_JPEG_QUALITY, 85])
            return relative_url
        except Exception as exc:
            logger.warning(f"Failed to save vehicle snapshot: {exc}")
            return ""
