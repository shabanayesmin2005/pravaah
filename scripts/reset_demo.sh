#!/usr/bin/env bash
# scripts/reset_demo.sh
# Safely resets PRAVAAH demo data and regenerates clean stream state.
set -euo pipefail

# Ensure running from repo root
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [ ! -f "$REPO_ROOT/.env" ]; then
  echo "Error: .env file not found in $REPO_ROOT"
  exit 1
fi

echo "=========================================================="
echo "              PRAVAAH Demo Data Reset"
echo "=========================================================="
echo "This will clear derived collections (detections, trajectories,"
echo "alerts, traffic_aggregates) and Redis alert cooldown keys."
echo "Core collections (users, audit_logs, cameras, blacklist) are preserved."
echo ""
read -r -p "Type 'RESET' to confirm: " CONFIRM

if [ "$CONFIRM" != "RESET" ]; then
  echo "Reset cancelled."
  exit 0
fi

LOG_FILE="/tmp/pravaah_reset_demo.log"
echo "Starting reset (detailed logs: $LOG_FILE)..."
: > "$LOG_FILE"

# 1. Purge derived collections, clear cooldowns, and seek Kafka consumer offsets
PYTHONPATH=. conda run -n pravaah python scripts/reset_demo.py --wipe >> "$LOG_FILE" 2>&1

# 2. Fast-publish synthetic events to Kafka
PYTHONPATH=ai-engine conda run -n pravaah python -m synthetic --seed 42 >> "$LOG_FILE" 2>&1

# 3. Process the batch in --once mode to rebuild alerts, trajectories, and traffic aggregates
PYTHONPATH=stream conda run -n pravaah python -m src.main --once --batch-size 1000 >> "$LOG_FILE" 2>&1

# 4. Print clean counts
PYTHONPATH=. conda run -n pravaah python scripts/reset_demo.py --counts
