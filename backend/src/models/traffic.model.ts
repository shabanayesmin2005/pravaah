import mongoose, { Document, Schema } from 'mongoose';

export interface ITrafficAggregate extends Document {
  camera_id: string;
  window_start: string;
  window_minutes: number;
  vehicle_count: number;
  type_mix: Record<string, number>;
  avg_confidence: number;
  congestion_index: number;
  updated_at: string | Date;
}

const TrafficAggregateSchema = new Schema<ITrafficAggregate>(
  {
    camera_id: { type: String, required: true, index: true },
    window_start: { type: String, required: true, index: true },
    window_minutes: { type: Number, default: 5 },
    vehicle_count: { type: Number, default: 0 },
    type_mix: { type: Schema.Types.Mixed, default: {} },
    avg_confidence: { type: Number, default: 0.0 },
    congestion_index: { type: Number, default: 0.0 },
    updated_at: { type: Schema.Types.Mixed, default: () => new Date().toISOString() },
  },
  {
    collection: 'traffic_aggregates',
    strict: false,
    timestamps: false,
  }
);

TrafficAggregateSchema.index({ camera_id: 1, window_start: 1 }, { unique: true });

export const TrafficAggregate = mongoose.model<ITrafficAggregate>(
  'TrafficAggregate',
  TrafficAggregateSchema,
  'traffic_aggregates'
);
