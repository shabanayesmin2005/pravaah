"""ai-engine/src/sources/image_source.py
Reads a folder of images in sorted order, looping indefinitely at a
configurable FPS. Optionally loads Pascal VOC XML annotations to supply
ground-truth plate text for dry-run comparison.
"""

from __future__ import annotations

import time
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Generator, Optional

import cv2
from loguru import logger

from .base import Frame, FrameSource


def _parse_voc_plate_texts(xml_path: Path) -> list[str]:
    """
    Parse plate text values from a Pascal VOC annotation file.
    Returns a list of number_plate_text attribute values (may be empty).
    Does NOT raise on parse errors — returns [] instead.
    """
    try:
        tree = ET.parse(xml_path)
        root = tree.getroot()
        texts: list[str] = []
        for obj in root.findall("object"):
            for attr in obj.findall("attributes/attribute"):
                name_el = attr.find("name")
                value_el = attr.find("value")
                if (
                    name_el is not None
                    and name_el.text == "number_plate_text"
                    and value_el is not None
                    and value_el.text
                ):
                    texts.append(value_el.text.strip())
        return texts
    except Exception as exc:
        logger.warning(f"Could not parse annotation {xml_path}: {exc}")
        return []


class ImageSource(FrameSource):
    """
    Loops a folder of JPEG images at a fixed FPS.

    Args:
        path:              Folder containing .jpg files.
        camera_id:         Camera identifier.
        fps:               Images per second (default 2.0).
        annotations_path:  Optional folder containing matching .xml files
                           (same filename stem as images). Used only in
                           dry-run mode to show ground-truth plate text.
    """

    def __init__(
        self,
        path: str | Path,
        camera_id: str,
        fps: float = 2.0,
        annotations_path: Optional[str | Path] = None,
    ) -> None:
        self.image_dir = Path(path)
        self.camera_id = camera_id
        self.fps = max(0.1, fps)
        self.annotations_dir: Optional[Path] = (
            Path(annotations_path) if annotations_path else None
        )

        if not self.image_dir.is_dir():
            raise NotADirectoryError(f"Image folder not found: {self.image_dir}")

        # Sort images for deterministic order across loops
        self._images = sorted(
            p for p in self.image_dir.iterdir()
            if p.suffix.lower() in {".jpg", ".jpeg", ".png"}
        )

        if not self._images:
            raise ValueError(f"No images found in {self.image_dir}")

        logger.info(
            f"[{camera_id}] ImageSource: {len(self._images)} images, "
            f"fps={self.fps}, annotations={'yes' if self.annotations_dir else 'no'}"
        )

    def _load_gt(self, img_path: Path) -> Optional[list[str]]:
        """Load ground-truth plate texts from paired annotation XML, if available."""
        if self.annotations_dir is None:
            return None
        xml_path = self.annotations_dir / (img_path.stem + ".xml")
        if not xml_path.exists():
            return None
        texts = _parse_voc_plate_texts(xml_path)
        return texts if texts else None

    def frames(self) -> Generator[Frame, None, None]:
        frame_index = 0
        interval = 1.0 / self.fps

        while True:
            for img_path in self._images:
                img = cv2.imread(str(img_path))
                if img is None:
                    logger.warning(f"[{self.camera_id}] Cannot read image: {img_path.name}")
                    continue

                gt = self._load_gt(img_path)

                yield Frame(
                    image=img,
                    frame_index=frame_index,
                    camera_id=self.camera_id,
                    source_type="image",
                    image_path=str(img_path),
                    gt_plate_texts=gt,
                )

                frame_index += 1
                time.sleep(interval)

    def close(self) -> None:
        pass
