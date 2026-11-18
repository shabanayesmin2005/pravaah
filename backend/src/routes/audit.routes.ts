import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { AuditLog } from '../models/auditLog.model';
import { authenticate } from '../middleware/auth';
import { requireRoles } from '../middleware/rbac';
import { validateRequest } from '../middleware/validate';
import { sendSuccess } from '../utils/response';

export const auditRouter = Router();

const auditQuerySchema = z.object({
  user_id: z.string().optional(),
  email: z.string().optional(),
  action: z.string().optional(),
  target: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

auditRouter.use(authenticate);
auditRouter.use(requireRoles(['Admin']));

// GET /audit-logs - paginated audit trail (Admin only)
auditRouter.get(
  '/',
  validateRequest({ query: auditQuerySchema }),
  async (req: Request, res: Response) => {
    const { user_id, email, action, target, from, to, page, limit } = req.query as any;

    const filter: Record<string, any> = {};
    if (user_id) filter.user_id = user_id;
    if (email) filter.email = email;
    if (action) filter.action = action;
    if (target) filter.target = { $regex: target, $options: 'i' };

    if (from || to) {
      filter.timestamp = {};
      if (from) filter.timestamp.$gte = new Date(from);
      if (to) filter.timestamp.$lte = new Date(to);
    }

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      AuditLog.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(filter),
    ]);

    return sendSuccess(
      res,
      logs,
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
