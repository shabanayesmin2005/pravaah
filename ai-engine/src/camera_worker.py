"""ai-engine/src/camera_worker.py
Orchestrates an AI detection worker for a single camera.
Reads frames -> Detects vehicles -> Tracks (video) or increments track_id (image) ->
Detects plates (image mode) -> OCR (image mode) -> Snapshot -> Validates & Publishes.
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from loguru import logger

from .config import config
from .detectors.ocr_engine import OcrEngine
from .detectors.plate_detector import PlateDetector
from .kafka_publisher import KafkaPublisher
from .models.detection import DetectionEvent
from .snapshot import SnapshotManager
from .sources.base import Frame, FrameSource
from .sources.image_source import ImageSource
from .sources.video_source import VideoSource
from .tracker import VehicleTracker


class CameraWorker:
    def __init__(
        self,
        camera_id: str,
        source: FrameSource,
        tracker: VehicleTracker,
        publisher: KafkaPublisher,
        snapshot_mgr: SnapshotManager,
        plate_detector: Optional[PlateDetector] = None,
        ocr_engine: Optional[OcrEngine] = None,
        dry_run: bool = False,
        limit: Optional[int] = None,
    ) -> None:
        self.camera_id = camera_id
        self.source = source
        self.tracker = tracker
        self.publisher = publisher
        self.snapshot_mgr = snapshot_mgr
        self.plate_detector = plate_detector
        self.ocr_engine = ocr_engine
        self.dry_run = dry_run
        self.limit = limit
        self.processed_frames = 0
        self.emitted_events = 0

    @classmethod
    def from_source_config(
        cls,
        camera_id: str,
        source_cfg: dict,
        publisher: KafkaPublisher,
        snapshot_mgr: SnapshotManager,
        allow_heuristic_fallback: bool = False,
        dry_run: bool = False,
        limit: Optional[int] = None,
        frame_skip: int = 5,
        fps: float = 2.0,
    ) -> "CameraWorker":
        source_type = source_cfg.get("type", "image")
        raw_path = source_cfg.get("path", "")
        # Resolve path relative to repo root if relative
        repo_root = Path(__file__).resolve().parents[2]
        path = repo_root / raw_path if not Path(raw_path).is_absolute() else Path(raw_path)

        if source_type == "video":
            source: FrameSource = VideoSource(
                path=path,
                camera_id=camera_id,
                frame_skip=frame_skip,
            )
            # In video mode, plates are unreadable -> plate detector & OCR are not initialized
            plate_detector = None
            ocr_engine = None
        else:
            annos_raw = source_cfg.get("annotations_path")
            annos_path = None
            if annos_raw:
                annos_path = repo_root / annos_raw if not Path(annos_raw).is_absolute() else Path(annos_raw)

            source = ImageSource(
                path=path,
                camera_id=camera_id,
                fps=source_cfg.get("fps", fps),
                annotations_path=annos_path,
            )
            plate_detector = PlateDetector(
                model_name_or_path=config.YOLO_PLATE_MODEL,
                allow_heuristic_fallback=allow_heuristic_fallback,
            )
            ocr_engine = OcrEngine(languages=["en"])

        tracker = VehicleTracker()

        return cls(
            camera_id=camera_id,
            source=source,
            tracker=tracker,
            publisher=publisher,
            snapshot_mgr=snapshot_mgr,
            plate_detector=plate_detector,
            ocr_engine=ocr_engine,
            dry_run=dry_run,
            limit=limit,
        )

    def run(self) -> None:
        """
        Main worker loop. Processes frames and emits detection events.
        """
        logger.info(
            f"Starting CameraWorker for {self.camera_id} "
            f"(dry_run={self.dry_run}, limit={self.limit})"
        )

        try:
            for frame in self.source.frames():
                self._process_frame(frame)
                self.processed_frames += 1

                if self.limit is not None and self.processed_frames >= self.limit:
                    logger.info(
                        f"[{self.camera_id}] Reached frame limit of {self.limit}. Stopping worker."
                    )
                    break
        except KeyboardInterrupt:
            logger.info(f"[{self.camera_id}] Interrupted by user.")
        finally:
            self.source.close()
            self.publisher.flush()
            logger.info(
                f"[{self.camera_id}] Worker finished. Processed frames: {self.processed_frames}, "
                f"Emitted events: {self.emitted_events}"
            )

    def _process_frame(self, frame: Frame) -> None:
        now_utc = datetime.now(timezone.utc)
        iso_ts = now_utc.isoformat()

        # 1. Vehicle Detection & Tracking
        if frame.source_type == "video":
            vehicles = self.tracker.track_video_frame(frame.image)
        else:
            vehicles = self.tracker.detect_image_frame(frame.image)

        if not vehicles:
            return

        for v in vehicles:
            plate_text = ""
            plate_confidence = 0.0
            plate_method = None

            # 2. Plate Detection & OCR (Image mode only)
            if frame.source_type == "image" and self.plate_detector is not None and self.ocr_engine is not None:
                plate_det = self.plate_detector.detect_in_vehicle(frame.image, v.bbox)
                if plate_det is not None:
                    plate_method = plate_det.method
                    is_heuristic = plate_det.method == "heuristic"
                    ocr_res = self.ocr_engine.read_plate(plate_det.plate_img, is_heuristic=is_heuristic)
                    plate_text = ocr_res.text
                    plate_confidence = ocr_res.confidence

                    # Log visual comparison against Ground Truth if available in dry-run
                    if self.dry_run and frame.gt_plate_texts:
                        img_name = Path(frame.image_path).name if frame.image_path else "frame"
                        logger.info(
                            f"[GT COMPARISON] Img: {img_name} | "
                            f"EasyOCR Read: '{plate_text}' (conf {plate_confidence:.2f}) | "
                            f"GT XML Plate: {frame.gt_plate_texts}"
                        )

            # 3. Snapshot
            track_id = v.track_id or 0
            snapshot_url = self.snapshot_mgr.save_vehicle_crop(
                frame=frame.image,
                bbox=list(v.bbox),
                camera_id=self.camera_id,
                track_id=track_id,
                timestamp=now_utc,
                dry_run=self.dry_run,
            )

            # 4. Construct DetectionEvent
            event = DetectionEvent(
                camera_id=self.camera_id,
                timestamp=iso_ts,
                plate_text=plate_text,
                plate_confidence=plate_confidence,
                vehicle_type=v.vehicle_type,
                bbox=list(v.bbox),
                track_id=track_id,
                snapshot_url=snapshot_url,
                plate_detector_method=plate_method,
            )

            # 5. Validate & Publish
            published = self.publisher.publish(event)
            if published:
                self.emitted_events += 1
