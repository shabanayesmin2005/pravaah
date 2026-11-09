/**
 * @file camera.ts
 * @description Camera network types for PRAVAAH.
 * Mirrors the structure of data/cameras.json.
 */

// ─── Camera ───────────────────────────────────────────────────────────────────

/** Geographic coordinate pair (WGS-84). */
export interface LatLng {
  lat: number;
  lng: number;
}

/** Urban zone classification — drives alert rules. */
export type CameraZone =
  | 'restricted'      // e.g. government buildings, VIP routes
  | 'commercial'      // market areas, high footfall
  | 'residential'     // lower speed limits
  | 'highway'         // arterial roads, higher speeds expected
  | 'transit'         // bus terminals, metro stations
  | 'general';

/** Operational status of a camera. */
export type CameraStatus = 'online' | 'offline' | 'degraded' | 'maintenance';

/** A single simulated/real camera node in the network. */
export interface Camera {
  /** Unique identifier, format: CAM_NNN (e.g. "CAM_001"). */
  id: string;

  /** Human-readable name of the installation point. */
  name: string;

  /** GPS coordinates of the camera (WGS-84). */
  location: LatLng;

  /** Street address or landmark description. */
  address: string;

  /** Zone classification for alert engine rules. */
  zone: CameraZone;

  /**
   * Simulated video source URI.
   * Format: sim://videos/<filename>  (looped file)
   *       or sim://planted/<scenario>  (scripted route)
   */
  rtsp_url: string;

  /** Whether this camera is currently active. */
  active: boolean;

  /** ISO-8601 timestamp of camera installation (seed data). */
  installed_at: string;

  /** Runtime status — set by the health monitor, not in cameras.json. */
  status?: CameraStatus;

  /** Last heartbeat ISO-8601 timestamp from the AI worker. */
  last_seen?: string;
}

// ─── Adjacency Graph ──────────────────────────────────────────────────────────

/**
 * A directed edge in the camera road-adjacency graph.
 * Both (from→to) and (to→from) edges are stored for undirected roads;
 * one-way roads have only one direction.
 */
export interface CameraEdge {
  /** Source camera ID. */
  from: string;

  /** Destination camera ID. */
  to: string;

  /** Name of the road / corridor connecting these two cameras. */
  road_name: string;

  /** Approximate road distance in metres. */
  distance_m: number;

  /**
   * Minimum expected travel time in seconds (at max legal/practical speed).
   * A vehicle appearing at `to` sooner than this after `from` triggers
   * an IMPOSSIBLE_TRAVEL alert.
   */
  min_travel_s: number;

  /**
   * Maximum expected travel time in seconds (at heavily congested speed).
   * Used for speed calculation upper bound.
   */
  max_travel_s: number;
}

/** The full camera network configuration loaded from data/cameras.json. */
export interface CamerasConfig {
  cameras: Camera[];
  adjacency_graph: {
    edges: CameraEdge[];
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a lookup map from camera ID → Camera object.
 * O(n) construction, O(1) lookup.
 */
export function buildCameraIndex(cameras: Camera[]): Map<string, Camera> {
  return new Map(cameras.map((c) => [c.id, c]));
}

/**
 * Build a nested adjacency map: cameraId → Set of reachable camera IDs.
 * Used by the trajectory builder for fast neighbour lookup.
 */
export function buildAdjacencyMap(
  edges: CameraEdge[],
): Map<string, Map<string, CameraEdge>> {
  const map = new Map<string, Map<string, CameraEdge>>();
  for (const edge of edges) {
    if (!map.has(edge.from)) map.set(edge.from, new Map());
    map.get(edge.from)!.set(edge.to, edge);
  }
  return map;
}

/**
 * Find the edge between two cameras, checking both directions.
 * Returns undefined if no direct edge exists (non-adjacent cameras).
 */
export function findEdge(
  adjacencyMap: Map<string, Map<string, CameraEdge>>,
  from: string,
  to: string,
): CameraEdge | undefined {
  return adjacencyMap.get(from)?.get(to) ?? adjacencyMap.get(to)?.get(from);
}
