FROM python:3.11-slim

LABEL maintainer="PRAVAAH Team <team@pravaah.local>"
LABEL description="PRAVAAH AI Engine — vehicle detection, plate OCR, Kafka publisher"

# System deps for OpenCV and PaddleOCR
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxrender1 \
    libxext6 \
    libgomp1 \
    wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY src/ ./src/

# Create directories for models and snapshots
RUN mkdir -p models data/video_samples

# Default: run all camera workers via the orchestrator
CMD ["python", "-m", "src.main"]
