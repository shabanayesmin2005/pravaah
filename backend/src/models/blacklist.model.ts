import mongoose, { Document, Schema } from 'mongoose';

export interface IBlacklist extends Document {
  plate_text: string;
  reason: string;
  added_by: string;
  added_at: string | Date;
  severity: string;
  agency: string;
}

const BlacklistSchema = new Schema<IBlacklist>(
  {
    plate_text: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    reason: { type: String, required: true },
    added_by: { type: String, required: true },
    added_at: { type: Schema.Types.Mixed, default: () => new Date().toISOString() },
    severity: {
      type: String,
      required: true,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'HIGH',
      index: true,
    },
    agency: { type: String, required: true, default: 'Delhi Police' },
  },
  {
    collection: 'blacklist',
    strict: false,
    timestamps: false,
  }
);

export const Blacklist = mongoose.model<IBlacklist>('Blacklist', BlacklistSchema, 'blacklist');
