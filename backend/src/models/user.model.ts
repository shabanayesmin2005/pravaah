import mongoose, { Document, Schema } from 'mongoose';

export type UserRole = 'Admin' | 'TrafficAuthority' | 'Police' | 'Analyst';

export interface IUser extends Document {
  user_id: string;
  email: string;
  password_hash: string;
  role: UserRole;
  name: string;
  created_at: Date;
  updated_at: Date;
}

const UserSchema = new Schema<IUser>(
  {
    user_id: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    password_hash: { type: String, required: true },
    role: {
      type: String,
      required: true,
      enum: ['Admin', 'TrafficAuthority', 'Police', 'Analyst'],
      index: true,
    },
    name: { type: String, required: true },
  },
  {
    collection: 'users',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

export const User = mongoose.model<IUser>('User', UserSchema, 'users');
