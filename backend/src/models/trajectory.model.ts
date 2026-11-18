import mongoose, { Document, Schema } from 'mongoose';

export interface ITrajectoryWaypoint {
  camera_id: string;
  timestamp: string;
  speed_from_prev_kmh?: number | null;
  distance_from_prev_m?: number | null;
  duration_from_prev_s?: number | null;
  impossible?: boolean;
}

export interface ITrajectorySegment {
  from_camera_id: string;
  to_camera_id: string;
  from_timestamp: string;
  to_timestamp: string;
  distance_m: number;
  duration_s: number;
  speed_kmh: number;
  impossible: boolean;
}

export interface ITrajectory extends Document {
  plate_text: string;
  vehicle_type?: string;
  first_seen?: string;
  last_seen?: string;
  total_distance_m?: number;
  total_duration_s?: number;
  impossible_travel?: boolean;
  waypoints?: ITrajectoryWaypoint[];
  segments?: ITrajectorySegment[];
  updated_at?: string | Date;
}

const TrajectorySchema = new Schema<ITrajectory>(
  {
    plate_text: { type: String, required: true, unique: true, index: true },
    vehicle_type: { type: String, default: 'car' },
    first_seen: { type: String },
    last_seen: { type: String },
    total_distance_m: { type: Number, default: 0 },
    total_duration_s: { type: Number, default: 0 },
    impossible_travel: { type: Boolean, default: false, index: true },
    waypoints: { type: [Schema.Types.Mixed], default: [] },
    segments: { type: [Schema.Types.Mixed], default: [] },
    updated_at: { type: Schema.Types.Mixed },
  },
  {
    collection: 'trajectories',
    strict: false,
    timestamps: false,
  }
);

export const Trajectory = mongoose.model<ITrajectory>('Trajectory', TrajectorySchema, 'trajectories');
