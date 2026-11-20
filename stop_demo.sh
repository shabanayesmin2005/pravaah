#!/usr/bin/env bash
# Stops the backend (4000) and frontend (5173). Docker data is kept.
cd "$(dirname "$0")" || exit 1
for port in 4000 5173; do
  pids=$(lsof -ti :$port 2>/dev/null)
  if [ -n "$pids" ]; then
    kill $pids && echo "Stopped the process on port $port"
  fi
done
echo "Docker services are still running and your data is kept."
echo "To stop them too: docker compose --env-file .env -f infra/docker-compose.yml stop"
