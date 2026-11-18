import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Detection } from '../models/detection.model';
import { Trajectory } from '../models/trajectory.model';
import { authenticate } from '../middleware/auth';
import { requireRoles } from '../middleware/rbac';
import { validateRequest } from '../middleware/validate';
import { logAudit } from '../services/audit.service';
import { sendSuccess, sendError } from '../utils/response';

export const vehiclesRouter = Router();

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() || req.ip || 'unknown';
  }
  return req.ip || 'unknown';
}

function normalizePlate(plate: string | undefined): string | null {
  if (!plate) return null;
  const clean = plate.trim().toUpperCase();
  if (!clean || clean === 'UNREADABLE') return null;
  return clean;
}

vehiclesRouter.use(authenticate);

// GET /vehicles/:plate/detections
vehiclesRouter.get(
  '/:plate/detections',
  requireRoles(['Admin', 'Police']),
  validateRequest({ query: paginationSchema }),
  async (req: Request, res: Response) => {
    const rawPlate = req.params.plate;
    const plate = normalizePlate(rawPlate);
    const ip = getClientIp(req);

    if (!plate) {
      return sendError(res, 'Valid non-empty plate text is required', 400);
    }

    const { page, limit } = req.query as any;
    const skip = (page - 1) * limit;

    const filter = {
      plate_text: { $regex: `^${plate}$`, $options: 'i' },
      has_plate: true,
    };

    const [detections, total] = await Promise.all([
      Detection.find(filter)
        .sort({ timestamp: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Detection.countDocuments(filter),
    ]);

    if (total === 0) {
      return sendError(res, `Vehicle with plate '${plate}' not found`, 404);
    }

    await logAudit({
      userId: req.user?.user_id,
      email: req.user?.email,
      role: req.user?.role,
      action: 'VEHICLE_DETECTIONS_VIEW',
      target: plate,
      ip,
      details: { count: detections.length, total },
    });

    return sendSuccess(
      res,
      detections,
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

// GET /vehicles/:plate/trajectory
vehiclesRouter.get(
  '/:plate/trajectory',
  requireRoles(['Admin', 'Police']),
  async (req: Request, res: Response) => {
    const rawPlate = req.params.plate;
    const plate = normalizePlate(rawPlate);
    const ip = getClientIp(req);

    if (!plate) {
      return sendError(res, 'Valid non-empty plate text is required', 400);
    }

    // First check pre-built trajectory in MongoDB
    let trajectory = await Trajectory.findOne({
      plate_text: { $regex: `^${plate}$`, $options: 'i' },
    }).lean();

    if (!trajectory) {
      // Check if there are any detections for this plate
      const count = await Detection.countDocuments({
        plate_text: { $regex: `^${plate}$`, $options: 'i' },
        has_plate: true,
      });

      if (count === 0) {
        return sendError(res, `No trajectory or detections found for vehicle '${plate}'`, 404);
      }

      // If detections exist but stream hasn't aggregated yet, fetch ordered waypoints
      const detections = await Detection.find({
        plate_text: { $regex: `^${plate}$`, $options: 'i' },
        has_plate: true,
      })
        .sort({ timestamp: 1 })
        .lean();

      trajectory = {
        plate_text: plate,
        vehicle_type: detections[0]?.vehicle_type || 'car',
        first_seen: detections[0]?.timestamp || '',
        last_seen: detections[detections.length - 1]?.timestamp || '',
        total_distance_m: 0,
        total_duration_s: 0,
        impossible_travel: false,
        waypoints: detections.map((d) => ({
          camera_id: d.camera_id,
          timestamp: d.timestamp,
          speed_from_prev_kmh: null,
          distance_from_prev_m: null,
          duration_from_prev_s: null,
          impossible: false,
        })),
        segments: [],
      } as any;
    }

    await logAudit({
      userId: req.user?.user_id,
      email: req.user?.email,
      role: req.user?.role,
      action: 'VEHICLE_TRAJECTORY_VIEW',
      target: plate,
      ip,
    });

    return sendSuccess(res, trajectory);
  }
);
