"""ai-engine/src/main.py
CLI entry point for the PRAVAAH AI Camera Worker.
Runs single camera by default, keeping CPU usage low.
Supports --dry-run, --frame-skip, --fps, --allow-heuristic-fallback, --all-cameras, --limit.
"""

from __future__ import annotations

import argparse
import json
import sys
import threading
from pathlib import Path

from loguru import logger

from .camera_worker import CameraWorker
from .config import config
from .kafka_publisher import KafkaPublisher
from .snapshot import SnapshotManager


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="PRAVAAH AI Camera Worker (YOLOv8 + ByteTrack + EasyOCR)"
    )
    parser.add_argument(
        "--camera",
        type=str,
        default=None,
        help="Camera ID to run (e.g. CAM_006). If omitted, uses the first camera in camera_source_map.json.",
    )
    parser.add_argument(
        "--source",
        type=str,
        choices=["image", "video"],
        default=None,
        help="Override source type ('image' or 'video').",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print/log detection events without connecting to or publishing to Kafka.",
    )
    parser.add_argument(
        "--frame-skip",
        type=int,
        default=5,
        help="Video frame-skip interval (process every Nth frame, default 5).",
    )
    parser.add_argument(
        "--fps",
        type=float,
        default=2.0,
        help="Image processing loop FPS (default 2.0).",
    )
    parser.add_argument(
        "--allow-heuristic-fallback",
        action="store_true",
        help="Allow heuristic bottom-crop fallback if the license plate model fails to load.",
    )
    parser.add_argument(
        "--all-cameras",
        action="store_true",
        help="Run workers for all cameras in camera_source_map.json concurrently in threads.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Stop worker after processing N frames (useful for verification/tests).",
    )
    return parser.parse_args()


def load_source_map() -> dict:
    source_map_path = config.SOURCE_MAP_PATH
    if not source_map_path.exists():
        logger.error(f"Camera source map not found: {source_map_path}")
        sys.exit(1)

    with open(source_map_path, "r", encoding="utf-8") as f:
        return json.load(f)


def main() -> None:
    args = parse_args()
    source_map = load_source_map()

    publisher = KafkaPublisher(dry_run=args.dry_run)
    snapshot_mgr = SnapshotManager()

    if args.all_cameras:
        logger.info(f"Starting multi-camera mode for {len(source_map)} cameras...")
        threads = []
        for cam_id, cfg in source_map.items():
            cam_cfg = dict(cfg)
            if args.source:
                cam_cfg["type"] = args.source

            worker = CameraWorker.from_source_config(
                camera_id=cam_id,
                source_cfg=cam_cfg,
                publisher=publisher,
                snapshot_mgr=snapshot_mgr,
                allow_heuristic_fallback=args.allow_heuristic_fallback,
                dry_run=args.dry_run,
                limit=args.limit,
                frame_skip=args.frame_skip,
                fps=args.fps,
            )
            t = threading.Thread(target=worker.run, name=f"Worker-{cam_id}", daemon=True)
            threads.append(t)
            t.start()

        for t in threads:
            t.join()
    else:
        # Single camera mode (default)
        cam_id = args.camera or next(iter(source_map.keys()))
        if cam_id not in source_map:
            logger.error(f"Camera {cam_id} not found in camera_source_map.json. Available: {list(source_map.keys())}")
            sys.exit(1)

        cam_cfg = dict(source_map[cam_id])
        if args.source:
            cam_cfg["type"] = args.source

        logger.info(f"Running single camera worker: {cam_id} (source={cam_cfg.get('type')})")
        worker = CameraWorker.from_source_config(
            camera_id=cam_id,
            source_cfg=cam_cfg,
            publisher=publisher,
            snapshot_mgr=snapshot_mgr,
            allow_heuristic_fallback=args.allow_heuristic_fallback,
            dry_run=args.dry_run,
            limit=args.limit,
            frame_skip=args.frame_skip,
            fps=args.fps,
        )
        worker.run()


if __name__ == "__main__":
    main()
