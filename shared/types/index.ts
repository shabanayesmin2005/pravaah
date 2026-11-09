/**
 * @file index.ts
 * @description Public API of the @pravaah/shared package.
 * Import from here, never from sub-files directly.
 *
 * @example
 *   import type { DetectionEvent, Camera, CameraEdge } from '@pravaah/shared';
 */

// ── Detection event contract ──────────────────────────────────────────────────
export type {
  DetectionEvent,
  VehicleType,
  ConfidenceTier,
  BoundingBox,
} from './detection.js';

export {
  getConfidenceTier,
  globalTrackId,
  isUUID,
} from './detection.js';

// ── Camera network types ───────────────────────────────────────────────────────
export type {
  Camera,
  CameraEdge,
  CamerasConfig,
  CameraZone,
  CameraStatus,
  LatLng,
} from './camera.js';

export {
  buildCameraIndex,
  buildAdjacencyMap,
  findEdge,
} from './camera.js';

// ── Re-export JSON Schema path for validation utilities ───────────────────────
// Consumer code: import detectionSchema from '@pravaah/shared/schemas/detection.schema.json'
