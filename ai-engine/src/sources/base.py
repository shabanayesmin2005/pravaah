"""ai-engine/src/sources/base.py
Abstract frame source interface and shared Frame dataclass.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Generator, Optional

import numpy as np


@dataclass
class Frame:
    """A single frame produced by any FrameSource."""

    image: np.ndarray
    """BGR image array (H, W, 3)."""

    frame_index: int
    """Monotonically increasing index within this source session."""

    camera_id: str
    """e.g. 'CAM_006'."""

    source_type: str
    """'video' or 'image'."""

    image_path: Optional[str] = None
    """Absolute path to the source image file (image mode only)."""

    gt_plate_texts: Optional[list[str]] = field(default=None)
    """
    Ground-truth plate text values loaded from paired Pascal VOC XML annotation.
    Present only for cameras that have an annotations_path in camera_source_map.json.
    Used for dry-run comparison output — NOT used by the AI pipeline.
    """


class FrameSource(ABC):
    """Abstract base class for all camera sources."""

    @abstractmethod
    def frames(self) -> Generator[Frame, None, None]:
        """
        Yields frames indefinitely (loops the underlying source).
        Callers are responsible for stopping iteration (e.g. via --limit).
        """
        ...

    @abstractmethod
    def close(self) -> None:
        """Release any held resources (file handles, etc.)."""
        ...

    def __enter__(self) -> "FrameSource":
        return self

    def __exit__(self, *_: object) -> None:
        self.close()
