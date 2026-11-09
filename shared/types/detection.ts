/**
 * @file detection.ts
 * @description Core detection event contract for the PRAVAAH platform.
 *
 * This is the SINGLE SOURCE OF TRUTH for the detection event schema.
 * All services (AI engine, stream processors, backend, frontend) must
 * conform to this contract.  The corresponding JSON Schema is at:
 *   shared/schemas/detection.schema.json
 *
 * Python equivalent (Pydantic) is generated in ai-engine/src/models/detection.py
 */

// ─── Enumerations ─────────────────────────────────────────────────────────────

/** Recognised vehicle categories (YOLO class → mapped label). */
export type VehicleType = 'car' | 'bike' | 'bus' | 'truck' | 'auto';

/** Plate reading confidence bucket for quick UI colouring. */
export type ConfidenceTier = 'high' | 'medium' | 'low' | 'unreadable';

// ─── Core Detection Event ─────────────────────────────────────────────────────

/**
 * Bounding box in absolute pixel coordinates of the source frame.
 * Tuple order: [x1, y1, x2, y2] (top-left, bottom-right).
 */
export type BoundingBox = [number, number, number, number];

/**
 * Detection event emitted to the Kafka `detections` topic by every
 * AI-engine camera worker.  Also stored verbatim in MongoDB.
 */
export interface DetectionEvent {
  /** UUID v4 – unique per event (deduplication key). */
  event_id: string;

  /** Camera identifier matching data/cameras.json (e.g. "CAM_001"). */
  camera_id: string;

  /** ISO-8601 UTC timestamp of frame capture (not Kafka ingestion time). */
  timestamp: string;

  /**
   * OCR result after multi-frame voting.
   * Empty string when plate was not readable (use vehicle_type + track_id
   * for Re-ID fallback instead).
   */
  plate_text: string;

  /**
   * Aggregate confidence score 0.0–1.0 combining:
   *   – plate detector confidence
   *   – OCR character confidence (mean)
   *   – multi-frame voting agreement ratio
   * 0.0 when plate_text is empty.
   */
  plate_confidence: number;

  /** YOLO-detected vehicle class mapped to the platform taxonomy. */
  vehicle_type: VehicleType;

  /**
   * Vehicle bounding box in source frame pixels [x1, y1, x2, y2].
   * Useful for cropping the snapshot image.
   */
  bbox: BoundingBox;

  /**
   * ByteTrack track ID, **scoped per camera**.
   * Global identity = `${camera_id}:${track_id}`.
   */
  track_id: number;

  /**
   * Relative URL to the JPEG snapshot served by the backend.
   * Pattern: /snapshots/<camera_id>/<track_id>_<YYYYMMDD>_<HHmmss>.jpg
   * Empty string if snapshot saving failed.
   */
  snapshot_url: string;

  // ── Optional fields added by stream processors ────────────────────────────

  /**
   * True when the plate did not match the Indian plate regex.
   * Set by the plate validator; retained through the pipeline.
   */
  plate_format_invalid?: boolean;

  /**
   * Confidence tier computed from plate_confidence for display.
   * Set by the trajectory builder / UI; not set by the AI engine.
   */
  confidence_tier?: ConfidenceTier;

  /**
   * Appearance embedding vector (OSNet, 512-dim) for Re-ID fallback.
   * Only present when the Re-ID module is active (Phase 6+).
   */
  appearance_embedding?: number[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the confidence tier for a given numeric confidence score. */
export function getConfidenceTier(confidence: number): ConfidenceTier {
  if (confidence >= 0.85) return 'high';
  if (confidence >= 0.65) return 'medium';
  if (confidence >= 0.4) return 'low';
  return 'unreadable';
}

/**
 * Returns the global vehicle identity string.
 * This is the cross-camera-unique identifier used by the trajectory builder.
 */
export function globalTrackId(cameraId: string, trackId: number): string {
  return `${cameraId}:${trackId}`;
}

/** Validates that a string looks like a UUID v4. */
export function isUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
