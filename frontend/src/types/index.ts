export type UserRole = 'Admin' | 'Police' | 'TrafficAuthority' | 'Analyst';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponseData {
  user: User;
  tokens: AuthTokens;
}

export interface CameraEdge {
  to_camera_id: string;
  distance_meters: number;
  free_flow_speed_kmh?: number;
  min_travel_time_seconds?: number;
  max_travel_time_seconds?: number;
}

export interface Camera {
  id: string;
  name: string;
  location: {
    lat: number;
    lng: number;
  };
  address: string;
  zone: string;
  rtsp_url: string;
  active: boolean;
  installed_at: string;
  edges: CameraEdge[];
}

export type AlertType = 'BLACKLIST_HIT' | 'IMPOSSIBLE_TRAVEL' | 'SUSPICIOUS_ROUTE';
export type AlertSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface Alert {
  _id?: string;
  alert_id: string;
  type: AlertType;
  plate_text: string;
  camera_id: string;
  timestamp: string;
  severity: AlertSeverity;
  description: string;
  snapshot_url?: string;
  acknowledged: boolean;
  status: AlertStatus;
  acknowledged_by?: string | null;
  acknowledged_at?: string | null;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface PlateSearchResult {
  _id: string;
  plate_text: string;
  vehicle_type: string;
  detection_count: number;
  first_seen: string;
  last_seen: string;
  latest_camera_id: string;
  latest_snapshot_url?: string;
}

export interface TrajectoryWaypoint {
  camera_id: string;
  timestamp: string;
  snapshot_url?: string;
  track_id?: number;
  confidence?: number;
  vehicle_type?: string;
  speed_from_prev_kmh?: number | null;
  distance_from_prev_m?: number | null;
  duration_from_prev_s?: number | null;
  impossible?: boolean;
}

export interface TrajectorySegment {
  from_camera: string;
  to_camera: string;
  distance_m: number;
  delta_time_s: number;
  implied_speed_kmh: number;
  impossible_travel: boolean;
}

export interface Trajectory {
  _id?: string;
  plate_text: string;
  vehicle_type?: string;
  first_seen?: string;
  last_seen?: string;
  total_distance_m: number;
  total_duration_s: number;
  impossible_travel: boolean;
  waypoints: TrajectoryWaypoint[];
  segments: TrajectorySegment[];
  updated_at?: string;
}

export interface CongestionItem {
  camera_id: string;
  name: string;
  location?: { lat: number; lng: number };
  zone: string;
  congestion_index: number;
  vehicle_count: number;
  avg_confidence: number;
  window_start: string;
  congestion_level: 'NORMAL' | 'MODERATE' | 'HIGH';
}

export interface TrafficSummary {
  total_vehicles_counted: number;
  active_cameras: number;
  aggregated_windows: number;
  vehicle_type_distribution: Record<string, number>;
  busiest_cameras: Array<{
    camera_id: string;
    total_vehicles: number;
    avg_congestion: number;
  }>;
}

export interface TrafficAggregate {
  _id: string;
  camera_id: string;
  window_start: string;
  window_minutes: number;
  vehicle_count: number;
  type_mix: Record<string, number>;
  avg_confidence: number;
  congestion_index: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}
