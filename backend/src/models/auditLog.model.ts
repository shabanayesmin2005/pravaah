import mongoose, { Document, Schema } from 'mongoose';

export type AuditAction =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'PLATE_SEARCH'
  | 'VEHICLE_DETECTIONS_VIEW'
  | 'VEHICLE_TRAJECTORY_VIEW'
  | 'BLACKLIST_ADD'
  | 'BLACKLIST_REMOVE'
  | 'ALERT_ACKNOWLEDGE'
  | 'ALERT_RESOLVE';

export interface IAuditLog extends Document {
  id: string;
  user_id: string | null;
  email: string | null;
  role: string | null;
  action: AuditAction;
  target: string | null;
  ip: string;
  timestamp: Date;
  details: Record<string, any>;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    id: { type: String, required: true, unique: true, index: true },
    user_id: { type: String, default: null, index: true },
    email: { type: String, default: null, index: true },
    role: { type: String, default: null, index: true },
    action: {
      type: String,
      required: true,
      index: true,
    },
    target: { type: String, default: null, index: true },
    ip: { type: String, default: 'unknown' },
    timestamp: { type: Date, default: Date.now, index: true },
    details: { type: Schema.Types.Mixed, default: {} },
  },
  {
    collection: 'audit_logs',
    timestamps: false,
  }
);

AuditLogSchema.index({ timestamp: -1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema, 'audit_logs');
