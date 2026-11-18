import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Alert } from '../models/alert.model';
import { authenticate } from '../middleware/auth';
import { requireRoles } from '../middleware/rbac';
import { validateRequest } from '../middleware/validate';
import { sanitizeAlertForRole } from '../utils/privacy';
import { logAudit } from '../services/audit.service';
import { sendSuccess, sendError } from '../utils/response';

export const alertsRouter = Router();

const listAlertsQuerySchema = z.object({
  type: z.enum(['BLACKLIST_HIT', 'IMPOSSIBLE_TRAVEL', 'SUSPICIOUS_ROUTE']).optional(),
  severity: z.enum(['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  status: z.enum(['OPEN', 'ACKNOWLEDGED', 'RESOLVED']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const patchAlertSchema = z.object({
  status: z.enum(['ACKNOWLEDGED', 'RESOLVED']),
  comment: z.string().optional(),
});

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() || req.ip || 'unknown';
  }
  return req.ip || 'unknown';
}

alertsRouter.use(authenticate);

// GET /alerts - list alerts with filtering & role-based sanitization
alertsRouter.get(
  '/',
  validateRequest({ query: listAlertsQuerySchema }),
  async (req: Request, res: Response) => {
    const { type, severity, status, from, to, page, limit } = req.query as any;

    const filter: Record<string, any> = {};
    if (type) filter.type = type;
    if (severity) filter.severity = severity;
    if (status) filter.status = status;

    if (from || to) {
      filter.timestamp = {};
      if (from) filter.timestamp.$gte = from;
      if (to) filter.timestamp.$lte = to;
    }

    const skip = (page - 1) * limit;

    const [alerts, total] = await Promise.all([
      Alert.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
      Alert.countDocuments(filter),
    ]);

    // Sanitize alerts for Analyst (plate masking)
    const sanitized = alerts.map((a) => sanitizeAlertForRole(a, req.user?.role));

    return sendSuccess(
      res,
      sanitized,
      undefined,
      {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1,
      }
    );
  }
);

// GET /alerts/:id - get alert by ID
alertsRouter.get('/:id', async (req: Request, res: Response) => {
  const alert = await Alert.findOne({ alert_id: req.params.id }).lean();
  if (!alert) {
    return sendError(res, `Alert with id '${req.params.id}' not found`, 404);
  }

  const sanitized = sanitizeAlertForRole(alert, req.user?.role);
  return sendSuccess(res, sanitized);
});

// PATCH /alerts/:id - acknowledge or resolve alert (Admin, Police, TrafficAuthority)
alertsRouter.patch(
  '/:id',
  requireRoles(['Admin', 'Police', 'TrafficAuthority']),
  validateRequest({ body: patchAlertSchema }),
  async (req: Request, res: Response) => {
    const { status, comment } = req.body;
    const ip = getClientIp(req);

    const updateFields: Record<string, any> = {
      status,
      acknowledged: true,
      acknowledged_by: req.user?.email || 'user',
      acknowledged_at: new Date().toISOString(),
    };

    if (comment) {
      updateFields['metadata.comment'] = comment;
    }

    const alert = await Alert.findOneAndUpdate(
      { alert_id: req.params.id },
      { $set: updateFields },
      { new: true }
    ).lean();

    if (!alert) {
      return sendError(res, `Alert with id '${req.params.id}' not found`, 404);
    }

    const action = status === 'RESOLVED' ? 'ALERT_RESOLVE' : 'ALERT_ACKNOWLEDGE';

    await logAudit({
      userId: req.user?.user_id,
      email: req.user?.email,
      role: req.user?.role,
      action,
      target: req.params.id,
      ip,
      details: { status, comment },
    });

    const sanitized = sanitizeAlertForRole(alert, req.user?.role);
    return sendSuccess(res, sanitized, `Alert marked as ${status}`);
  }
);
