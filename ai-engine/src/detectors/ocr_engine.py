"""ai-engine/src/detectors/ocr_engine.py
OCR engine using EasyOCR (CPU only) with image preprocessing
(upscaling, CLAHE contrast enhancement, denoising).
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional

import cv2
import easyocr
import numpy as np
from loguru import logger


@dataclass
class OcrResult:
    text: str
    confidence: float
    raw_detections: list[tuple[str, float]]


class OcrEngine:
    def __init__(self, languages: list[str] = ["en"]) -> None:
        logger.info(f"Initialising EasyOCR engine (languages={languages}, gpu=False)")
        self.reader = easyocr.Reader(languages, gpu=False)

    @staticmethod
    def preprocess_plate(img: np.ndarray) -> np.ndarray:
        """
        Preprocess plate crop:
        1. Upscale if too small (minimum height 150px).
        2. Convert to Grayscale.
        3. CLAHE contrast enhancement.
        4. Gaussian blur denoising.
        """
        h, w = img.shape[:2]
        if h == 0 or w == 0:
            return img

        # 1. Upscale if small
        target_h = max(150, h)
        if target_h > h:
            scale = target_h / h
            target_w = int(w * scale)
            proc = cv2.resize(img, (target_w, target_h), interpolation=cv2.INTER_CUBIC)
        else:
            proc = img.copy()

        # 2. Grayscale
        if len(proc.shape) == 3 and proc.shape[2] == 3:
            gray = cv2.cvtColor(proc, cv2.COLOR_BGR2GRAY)
        else:
            gray = proc

        # 3. CLAHE (Contrast Limited Adaptive Histogram Equalization)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        contrast = clahe.apply(gray)

        # 4. Light Gaussian blur for noise removal
        denoised = cv2.GaussianBlur(contrast, (3, 3), 0)
        return denoised

    def read_plate(self, plate_img: np.ndarray, is_heuristic: bool = False) -> OcrResult:
        """
        Read text from plate image crop.
        """
        if plate_img is None or plate_img.size == 0:
            return OcrResult(text="", confidence=0.0, raw_detections=[])

        preprocessed = self.preprocess_plate(plate_img)

        try:
            # detail=1 returns list of (bbox, text, prob)
            results = self.reader.readtext(preprocessed, detail=1)
        except Exception as exc:
            logger.warning(f"EasyOCR read failed: {exc}")
            return OcrResult(text="", confidence=0.0, raw_detections=[])

        if not results:
            return OcrResult(text="", confidence=0.0, raw_detections=[])

        texts: list[str] = []
        confs: list[float] = []
        raw: list[tuple[str, float]] = []

        for item in results:
            # item format: (bbox, text, confidence)
            _, raw_text, conf = item
            clean = re.sub(r"[^A-Za-z0-9]", "", raw_text).upper()
            if clean:
                texts.append(clean)
                confs.append(float(conf))
                raw.append((clean, float(conf)))

        if not texts:
            return OcrResult(text="", confidence=0.0, raw_detections=[])

        combined_text = "".join(texts)
        mean_conf = float(np.mean(confs)) if confs else 0.0

        if is_heuristic and mean_conf > 0.49:
            mean_conf = 0.49

        return OcrResult(
            text=combined_text,
            confidence=round(mean_conf, 4),
            raw_detections=raw,
        )
