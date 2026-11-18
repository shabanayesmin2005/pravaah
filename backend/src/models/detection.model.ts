import mongoose, { Document, Schema } from 'mongoose';

export interface IDetection extends Document {
  event_id: string;
  camera_id: string;
  timestamp: string;
  plate_text: string;
  plate_confidence: number;
  vehicle_type: string;
  bbox: number[];
  track_id: number;
  snapshot_url: string;
  has_plate: boolean;
  is_synthetic: boolean;
  synthetic_scenario_id?: string | null;
  plate_detector_method?: string;
}

const DetectionSchema = new Schema<IDetection>(
  {
    event_id: { type: String, required: true, unique: true, index: true },
    camera_id: { type: String, required: true, index: true },
    timestamp: { type: String, required: true, index: true },
    plate_text: { type: String, default: '', index: true },
    plate_confidence: { type: Number, default: 0.0 },
    vehicle_type: { type: String, default: 'car' },
    bbox: { type: [Number], default: [] },
    track_id: { type: Number, default: 0 },
    snapshot_url: { type: String, default: '' },
    has_plate: { type: Boolean, default: false, index: true },
    is_synthetic: { type: Boolean, default: false },
    synthetic_scenario_id: { type: String, default: null },
    plate_detector_method: { type: String, default: 'heuristic' },
  },
  {
    collection: 'detections',
    strict: false,
    timestamps: false,
  }
);

DetectionSchema.index({ plate_text: 1, timestamp: 1 });
DetectionSchema.index({ camera_id: 1, timestamp: 1 });

export const Detection = mongoose.model<IDetection>('Detection', DetectionSchema, 'detections');
