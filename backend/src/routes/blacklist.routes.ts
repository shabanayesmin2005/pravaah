import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Blacklist } from '../models/blacklist.model';
import { redis } from '../lib/redis';
import { authenticate } from '../middleware/auth';
import { requireRoles } from '../middleware/rbac';
import { validateRequest } from '../middleware/validate';
import { logAudit } from '../services/audit.service';
import { sendSuccess, sendError } from '../utils/response';

export const blacklistRouter = Router();

const createBlacklistSchema = z.object({
  plate_text: z.string().trim().min(3).max(15),
  reason: z.string().trim().min(3),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('HIGH'),
  agency: z.string().trim().min(2).default('Delhi Police'),
});

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() || req.ip || 'unknown';
  }
  return req.ip || 'unknown';
}

blacklistRouter.use(authenticate);
blacklistRouter.use(requireRoles(['Admin', 'Police']));

// GET /blacklist - list all blacklisted vehicles
blacklistRouter.get('/', async (_req: Request, res: Response) => {
  const list = await Blacklist.find().sort({ added_at: -1 }).lean();
  return sendSuccess(res, list);
});

// POST /blacklist - add vehicle to blacklist and sync to Redis set blacklist:plates
blacklistRouter.post(
  '/',
  validateRequest({ body: createBlacklistSchema }),
  async (req: Request, res: Response) => {
    const { reason, severity, agency } = req.body;
    const plate = req.body.plate_text.trim().toUpperCase();
    const ip = getClientIp(req);

    // 1. Upsert into MongoDB
    const entry = await Blacklist.findOneAndUpdate(
      { plate_text: plate },
      {
        plate_text: plate,
        reason,
        severity,
        agency,
        added_by: req.user?.email || 'admin@pravaah.local',
        added_at: new Date().toISOString(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    // 2. Synchronize immediately with Redis set blacklist:plates
    try {
      await redis.sadd('blacklist:plates', plate);
    } catch (err) {
      console.error('Failed to sync to Redis blacklist set:', err);
    }

    // 3. Audit log
    await logAudit({
      userId: req.user?.user_id,
      email: req.user?.email,
      role: req.user?.role,
      action: 'BLACKLIST_ADD',
      target: plate,
      ip,
      details: { reason, severity, agency },
    });

    return sendSuccess(res, entry, `Plate '${plate}' blacklisted successfully`, undefined, 201);
  }
);

// DELETE /blacklist/:plate - remove vehicle from blacklist and sync to Redis set blacklist:plates
blacklistRouter.delete('/:plate', async (req: Request, res: Response) => {
  const rawPlate = req.params.plate;
  if (!rawPlate) {
    return sendError(res, 'Plate parameter is required', 400);
  }
  const plate = rawPlate.trim().toUpperCase();
  const ip = getClientIp(req);

  const deleted = await Blacklist.findOneAndDelete({ plate_text: plate }).lean();
  if (!deleted) {
    return sendError(res, `Plate '${plate}' not found in blacklist`, 404);
  }

  // Synchronize immediately with Redis set blacklist:plates
  try {
    await redis.srem('blacklist:plates', plate);
  } catch (err) {
    console.error('Failed to remove from Redis blacklist set:', err);
  }

  await logAudit({
    userId: req.user?.user_id,
    email: req.user?.email,
    role: req.user?.role,
    action: 'BLACKLIST_REMOVE',
    target: plate,
    ip,
    details: { reason: deleted.reason },
  });

  return sendSuccess(res, { plate_text: plate }, `Plate '${plate}' removed from blacklist`);
});
