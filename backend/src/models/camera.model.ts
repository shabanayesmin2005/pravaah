import mongoose, { Document, Schema } from 'mongoose';

export interface ICameraEdge {
  to_camera_id: string;
  distance_meters: number;
  free_flow_speed_kmh?: number;
  min_travel_time_seconds?: number;
  max_travel_time_seconds?: number;
}

export interface ICamera extends Document {
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
  edges: ICameraEdge[];
}

const CameraEdgeSchema = new Schema<ICameraEdge>(
  {
    to_camera_id: { type: String, required: true },
    distance_meters: { type: Number, required: true },
    free_flow_speed_kmh: { type: Number },
    min_travel_time_seconds: { type: Number },
    max_travel_time_seconds: { type: Number },
  },
  { _id: false }
);

const CameraSchema = new Schema<ICamera>(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    address: { type: String, required: true },
    zone: { type: String, default: 'general', index: true },
    rtsp_url: { type: String, default: '' },
    active: { type: Boolean, default: true, index: true },
    installed_at: { type: String, default: () => new Date().toISOString() },
    edges: { type: [CameraEdgeSchema], default: [] },
  },
  {
    collection: 'cameras',
    strict: false,
    timestamps: false,
  }
);

export const Camera = mongoose.model<ICamera>('Camera', CameraSchema, 'cameras');
