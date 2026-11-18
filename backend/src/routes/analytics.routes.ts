import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { TrafficAggregate } from '../models/traffic.model';
import { Camera } from '../models/camera.model';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import { sendSuccess } from '../utils/response';

export const analyticsRouter = Router();

const trafficQuerySchema = z.object({
  camera_id: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  window_minutes: z.coerce.number().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(50),
});

analyticsRouter.use(authenticate);

// GET /analytics/traffic - time-windowed traffic metrics
analyticsRouter.get(
  '/traffic',
  validateRequest({ query: trafficQuerySchema }),
  async (req: Request, res: Response) => {
    const { camera_id, from, to, window_minutes, page, limit } = req.query as any;

    const filter: Record<string, any> = {};
    if (camera_id) filter.camera_id = camera_id;
    if (window_minutes) filter.window_minutes = window_minutes;

    if (from || to) {
      filter.window_start = {};
      if (from) filter.window_start.$gte = from;
      if (to) filter.window_start.$lte = to;
    }

    const skip = (page - 1) * limit;

    const [aggregates, total] = await Promise.all([
      TrafficAggregate.find(filter)
        .sort({ window_start: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      TrafficAggregate.countDocuments(filter),
    ]);

    return sendSuccess(
      res,
      aggregates,
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

// GET /analytics/congestion - latest congestion index per camera
analyticsRouter.get('/congestion', async (_req: Request, res: Response) => {
  // Aggregate to get the latest window document for each camera_id
  const latestByCamera = await TrafficAggregate.aggregate([
    { $sort: { window_start: -1 } },
    {
      $group: {
        _id: '$camera_id',
        camera_id: { $first: '$camera_id' },
        window_start: { $first: '$window_start' },
        congestion_index: { $first: '$congestion_index' },
        vehicle_count: { $first: '$vehicle_count' },
        avg_confidence: { $first: '$avg_confidence' },
      },
    },
    { $sort: { congestion_index: -1 } },
  ]);

  // Join with camera details if available
  const cameraIds = latestByCamera.map((c) => c.camera_id);
  const cameras = await Camera.find({ id: { $in: cameraIds } }).lean();
  const cameraMap = new Map(cameras.map((c) => [c.id, c]));

  const result = latestByCamera.map((c) => {
    const cam = cameraMap.get(c.camera_id);
    return {
      camera_id: c.camera_id,
      name: cam?.name || c.camera_id,
      location: cam?.location,
      zone: cam?.zone || 'unknown',
      congestion_index: c.congestion_index,
      vehicle_count: c.vehicle_count,
      avg_confidence: c.avg_confidence,
      window_start: c.window_start,
      congestion_level:
        c.congestion_index >= 1.5 ? 'HIGH' : c.congestion_index >= 1.0 ? 'MODERATE' : 'NORMAL',
    };
  });

  return sendSuccess(res, result);
});

// GET /analytics/summary - city-wide overview
analyticsRouter.get('/summary', async (_req: Request, res: Response) => {
  const [totalVehiclesAgg, typeMixAgg, cameraCount, alertCount] = await Promise.all([
    TrafficAggregate.aggregate([
      {
        $group: {
          _id: null,
          total_vehicles: { $sum: '$vehicle_count' },
        },
      },
    ]),
    TrafficAggregate.aggregate([
      { $project: { type_mix: { $objectToArray: '$type_mix' } } },
      { $unwind: '$type_mix' },
      {
        $group: {
          _id: '$type_mix.k',
          count: { $sum: '$type_mix.v' },
        },
      },
    ]),
    Camera.countDocuments({ active: true }),
    TrafficAggregate.countDocuments(),
  ]);

  const vehicleTypeMix: Record<string, number> = {};
  for (const item of typeMixAgg) {
    vehicleTypeMix[item._id] = item.count;
  }

  const busiestCameras = await TrafficAggregate.aggregate([
    {
      $group: {
        _id: '$camera_id',
        total_vehicles: { $sum: '$vehicle_count' },
        avg_congestion: { $avg: '$congestion_index' },
      },
    },
    { $sort: { total_vehicles: -1 } },
    { $limit: 5 },
  ]);

  return sendSuccess(res, {
    total_vehicles_counted: totalVehiclesAgg[0]?.total_vehicles || 0,
    active_cameras: cameraCount,
    aggregated_windows: alertCount,
    vehicle_type_distribution: vehicleTypeMix,
    busiest_cameras: busiestCameras.map((b) => ({
      camera_id: b._id,
      total_vehicles: b.total_vehicles,
      avg_congestion: Number(b.avg_congestion.toFixed(2)),
    })),
  });
});
