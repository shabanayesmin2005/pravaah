import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Detection } from '../models/detection.model';
import { authenticate } from '../middleware/auth';
import { requireRoles } from '../middleware/rbac';
import { validateRequest } from '../middleware/validate';
import { logAudit } from '../services/audit.service';
import { sendSuccess, sendError } from '../utils/response';

export const platesRouter = Router();

const searchQuerySchema = z.object({
  q: z.string().trim().min(1, 'Search query q is required and cannot be empty'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() || req.ip || 'unknown';
  }
  return req.ip || 'unknown';
}

platesRouter.use(authenticate);

// GET /plates/search?q=
platesRouter.get(
  '/search',
  requireRoles(['Admin', 'Police']),
  validateRequest({ query: searchQuerySchema }),
  async (req: Request, res: Response) => {
    const { q, page, limit } = req.query as any;
    const ip = getClientIp(req);

    // Escape regex special chars to prevent regex injection
    const escapedQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Rule: plate_text must be non-empty and has_plate must be true
    const filter = {
      plate_text: {
        $exists: true,
        $ne: '',
        $regex: escapedQ,
        $options: 'i',
      },
      has_plate: true,
    };

    const skip = (page - 1) * limit;

    // Use aggregation to group by unique plate_text and return summary info
    const [platesAgg, totalCountAgg] = await Promise.all([
      Detection.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$plate_text',
            plate_text: { $first: '$plate_text' },
            vehicle_type: { $first: '$vehicle_type' },
            detection_count: { $sum: 1 },
            first_seen: { $min: '$timestamp' },
            last_seen: { $max: '$timestamp' },
            latest_camera_id: { $last: '$camera_id' },
            latest_snapshot_url: { $last: '$snapshot_url' },
          },
        },
        { $sort: { last_seen: -1 } },
        { $skip: skip },
        { $limit: limit },
      ]),
      Detection.aggregate([
        { $match: filter },
        { $group: { _id: '$plate_text' } },
        { $count: 'total' },
      ]),
    ]);

    const total = totalCountAgg[0]?.total || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    // Audit log this search
    await logAudit({
      userId: req.user?.user_id,
      email: req.user?.email,
      role: req.user?.role,
      action: 'PLATE_SEARCH',
      target: q,
      ip,
      details: {
        query: q,
        matchCount: platesAgg.length,
        totalMatches: total,
      },
    });

    return sendSuccess(
      res,
      platesAgg,
      undefined,
      {
        total,
        page,
        limit,
        pages: totalPages,
      }
    );
  }
);
