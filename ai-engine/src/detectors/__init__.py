"""ai-engine/src/detectors/__init__.py"""
from .vehicle_detector import VehicleDetector, VehicleDetection
from .plate_detector import PlateDetector, PlateDetection
from .ocr_engine import OcrEngine, OcrResult

__all__ = [
    "VehicleDetector",
    "VehicleDetection",
    "PlateDetector",
    "PlateDetection",
    "OcrEngine",
    "OcrResult",
]
