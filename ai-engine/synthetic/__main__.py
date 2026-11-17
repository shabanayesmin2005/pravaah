"""ai-engine/synthetic/__main__.py
CLI entry point for the PRAVAAH synthetic event generator.
Usage:
  python -m synthetic --seed 42 --speed 2.0 --dry-run
"""

from __future__ import annotations

import argparse
from pathlib import Path

from loguru import logger

from src.config import config
from src.kafka_publisher import KafkaPublisher
from .generator import SyntheticEventGenerator


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="PRAVAAH Synthetic Detection Event Generator"
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed for deterministic event generation (default 42).",
    )
    parser.add_argument(
        "--speed",
        type=float,
        default=1.0,
        help="Time speed multiplier (e.g. 2.0 = events spaced twice as close in time).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print events and write JSONL without publishing to Kafka.",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=str(config.DEMO_EVENTS_PATH),
        help=f"Output JSONL file path (default: {config.DEMO_EVENTS_PATH}).",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    logger.info(
        f"Initialising SyntheticEventGenerator (seed={args.seed}, speed={args.speed}, dry_run={args.dry_run})"
    )

    publisher = KafkaPublisher(dry_run=args.dry_run)
    generator = SyntheticEventGenerator(
        seed=args.seed,
        speed=args.speed,
        publisher=publisher,
        output_file=Path(args.output),
    )

    events = generator.run(dry_run=args.dry_run)
    logger.info(f"Done! Generated {len(events)} synthetic events.")


if __name__ == "__main__":
    main()
