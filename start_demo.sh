#!/usr/bin/env bash
# PRAVAAH demo launcher: Docker services + backend + frontend
cd "$(dirname "$0")" || exit 1

if [ ! -f .env ]; then
  echo "ERROR: .env not found. Copy .env.example to .env and replace every CHANGE_ME first."
  exit 1
fi

echo "1/4 Starting Docker services (Kafka, MongoDB, Redis)..."
if ! docker compose --env-file .env -f infra/docker-compose.yml up -d; then
  echo "ERROR: Docker failed. Is Docker Desktop open and running?"
  exit 1
fi

echo "2/4 Waiting for services to become healthy..."
for c in pravaah-kafka pravaah-mongodb pravaah-redis; do
  status="missing"
  for i in $(seq 1 60); do
    status=$(docker inspect --format '{{.State.Health.Status}}' "$c" 2>/dev/null || echo "missing")
    [ "$status" = "healthy" ] && break
    sleep 2
  done
  echo "   $c: $status"
  if [ "$status" != "healthy" ]; then
    echo "ERROR: $c did not become healthy. Check: docker logs $c"
    exit 1
  fi
done

mkdir -p .demo-logs

echo "3/4 Starting backend on port 4000..."
npm run dev --workspace=backend > .demo-logs/backend.log 2>&1 &

echo "4/4 Starting frontend on port 5173..."
npm run dev --workspace=frontend > .demo-logs/frontend.log 2>&1 &

echo "Waiting for the backend to answer..."
for i in $(seq 1 40); do
  if curl -s http://localhost:4000/api/v1/health > /dev/null; then
    echo "Backend is up."
    break
  fi
  sleep 2
done

echo ""
echo "PRAVAAH is ready: http://localhost:5173"
echo "Logs: .demo-logs/backend.log and .demo-logs/frontend.log"
open http://localhost:5173 2>/dev/null
