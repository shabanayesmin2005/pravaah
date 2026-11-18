import { v4 as uuidv4 } from 'uuid';
import { AuditLog, AuditAction } from '../models/auditLog.model';

export interface LogAuditParams {
  userId?: string | null;
  email?: string | null;
  role?: string | null;
  action: AuditAction;
  target?: string | null;
  ip?: string;
  details?: Record<string, any>;
}

export async function logAudit({
  userId,
  email,
  role,
  action,
  target,
  ip = 'unknown',
  details = {},
}: LogAuditParams): Promise<void> {
  try {
    await AuditLog.create({
      id: uuidv4(),
      user_id: userId || null,
      email: email || null,
      role: role || null,
      action,
      target: target || null,
      ip: ip || 'unknown',
      timestamp: new Date(),
      details: details || {},
    });
  } catch (error) {
    console.error('Failed to write audit log entry:', error);
  }
}
