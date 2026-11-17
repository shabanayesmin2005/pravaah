"""ai-engine/src/validator.py
Validates DetectionEvent payloads against shared/schemas/detection.schema.json
using python jsonschema.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import jsonschema
from jsonschema import Draft7Validator
from loguru import logger

from .config import config


class EventValidator:
    def __init__(self, schema_path: Path | str | None = None) -> None:
        p = Path(schema_path or config.SCHEMA_PATH)
        if not p.exists():
            raise FileNotFoundError(f"Detection schema not found at {p}")

        with open(p, "r", encoding="utf-8") as f:
            self.schema = json.load(f)

        Draft7Validator.check_schema(self.schema)
        self.validator = Draft7Validator(self.schema)
        logger.info(f"Loaded DetectionEvent JSON schema from {p}")

    def validate(self, event_dict: dict[str, Any]) -> bool:
        """
        Validate event dictionary against schema.
        Returns True if valid, False if invalid (with log message).
        """
        errors = sorted(self.validator.iter_errors(event_dict), key=lambda e: e.path)
        if errors:
            for err in errors:
                loc = ".".join(str(p) for p in err.path) or "root"
                logger.error(f"Schema validation error at [{loc}]: {err.message}")
            return False
        return True

    def validate_or_raise(self, event_dict: dict[str, Any]) -> None:
        """
        Validate and raise jsonschema.ValidationError if invalid.
        """
        self.validator.validate(event_dict)
