FROM python:3.11-slim

LABEL maintainer="PRAVAAH Team <team@pravaah.local>"
LABEL description="PRAVAAH Stream Processors — Kafka consumers for trajectory, analytics, alerts"

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/

CMD ["python", "-m", "src.main"]
