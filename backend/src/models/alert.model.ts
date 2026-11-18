import mongoose, { Document, Schema } from 'mongoose';

export type AlertType = 'BLACKLIST_HIT' | 'IMPOSSIBLE_TRAVEL' | 'SUSPICIOUS_ROUTE';
export type AlertSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface IAlert extends Document {
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
  created_at: string | Date;
}

const AlertSchema = new Schema<IAlert>(
  {
    alert_id: { type: String, required: true, unique: true, index: true },
    type: {
      type: String,
      required: true,
      enum: ['BLACKLIST_HIT', 'IMPOSSIBLE_TRAVEL', 'SUSPICIOUS_ROUTE'],
      index: true,
    },
    plate_text: { type: String, required: true, index: true },
    camera_id: { type: String, required: true, index: true },
    timestamp: { type: String, required: true, index: true },
    severity: {
      type: String,
      required: true,
      enum: ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      index: true,
    },
    description: { type: String, required: true },
    snapshot_url: { type: String, default: '' },
    acknowledged: { type: Boolean, default: false, index: true },
    status: {
      type: String,
      default: 'OPEN',
      enum: ['OPEN', 'ACKNOWLEDGED', 'RESOLVED'],
      index: true,
    },
    acknowledged_by: { type: String, default: null },
    acknowledged_at: { type: String, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
    created_at: { type: Schema.Types.Mixed, default: () => new Date().toISOString() },
  },
  {
    collection: 'alerts',
    strict: false,
    timestamps: false,
  }
);

AlertSchema.index({ type: 1, severity: 1, acknowledged: 1 });
AlertSchema.index({ timestamp: -1 });

export const Alert = mongoose.model<IAlert>('Alert', AlertSchema, 'alerts');
