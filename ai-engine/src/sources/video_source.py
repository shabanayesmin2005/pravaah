"""ai-engine/src/sources/video_source.py
Reads a CityFlow vdo.avi file in an infinite loop, applying frame-skip.
Plate OCR is SKIPPED for video sources — plate_text="" and plate_confidence=0.0
are enforced by camera_worker.py, not here.
"""

from __future__ import annotations

import time
from pathlib import Path
from typing import Generator

import cv2
from loguru import logger

from .base import Frame, FrameSource


class VideoSource(FrameSource):
    """
    Loops a single video file indefinitely.

    Args:
        path:        Absolute or repo-relative path to the video file.
        camera_id:   Camera identifier (e.g. 'CAM_001').
        frame_skip:  Process every Nth frame; others are dropped.
                     Default 5 → 2 effective FPS on a 10 FPS source.
    """

    def __init__(self, path: str | Path, camera_id: str, frame_skip: int = 5) -> None:
        self.path = Path(path)
        self.camera_id = camera_id
        self.frame_skip = max(1, frame_skip)

        if not self.path.exists():
            raise FileNotFoundError(f"Video file not found: {self.path}")

        logger.info(
            f"[{camera_id}] VideoSource: {self.path.name}  frame_skip={self.frame_skip}"
        )

    def frames(self) -> Generator[Frame, None, None]:
        global_idx = 0
        loop_count = 0

        while True:
            cap = cv2.VideoCapture(str(self.path))
            if not cap.isOpened():
                logger.error(f"[{self.camera_id}] Cannot open video: {self.path}")
                time.sleep(2.0)
                continue

            loop_count += 1
            local_idx = 0
            logger.debug(f"[{self.camera_id}] Starting video loop #{loop_count}")

            while True:
                ret, frame = cap.read()
                if not ret:
                    break  # end of file → restart loop

                if local_idx % self.frame_skip == 0:
                    yield Frame(
                        image=frame,
                        frame_index=global_idx,
                        camera_id=self.camera_id,
                        source_type="video",
                    )
                    global_idx += 1

                local_idx += 1

            cap.release()

    def close(self) -> None:
        pass  # VideoCapture is released inside the generator
