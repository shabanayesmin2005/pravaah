import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Camera } from '../models/camera.model';
import { authenticate } from '../middleware/auth';
import { requireRoles } from '../middleware/rbac';
import { validateRequest } from '../middleware/validate';
import { sendSuccess, sendError } from '../utils/response';

export const camerasRouter = Router();

const createCameraSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  location: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
  address: z.string().min(1),
  zone: z.string().default('general'),
  rtsp_url: z.string().default(''),
  active: z.boolean().default(true),
  edges: z
    .array(
      z.object({
        to_camera_id: z.string(),
        distance_meters: z.number(),
        free_flow_speed_kmh: z.number().optional(),
        min_travel_time_seconds: z.number().optional(),
        max_travel_time_seconds: z.number().optional(),
      })
    )
    .default([]),
});

const patchCameraSchema = z.object({
  name: z.string().optional(),
  location: z
    .object({
      lat: z.number(),
      lng: z.number(),
    })
    .optional(),
  address: z.string().optional(),
  zone: z.string().optional(),
  rtsp_url: z.string().optional(),
  active: z.boolean().optional(),
});

// All camera routes require authentication
camerasRouter.use(authenticate);

// GET /cameras - list all cameras
camerasRouter.get('/', async (req: Request, res: Response) => {
  const { zone, active } = req.query;
  const filter: Record<string, any> = {};

  if (zone && typeof zone === 'string') {
    filter.zone = zone;
  }
  if (active !== undefined) {
    filter.active = active === 'true';
  }

  const cameras = await Camera.find(filter).lean();
  return sendSuccess(res, cameras);
});

// GET /cameras/:id - get specific camera
camerasRouter.get('/:id', async (req: Request, res: Response) => {
  const camera = await Camera.findOne({ id: req.params.id }).lean();
  if (!camera) {
    return sendError(res, `Camera with id '${req.params.id}' not found`, 404);
  }
  return sendSuccess(res, camera);
});

// POST /cameras - create camera (Admin only)
camerasRouter.post(
  '/',
  requireRoles(['Admin']),
  validateRequest({ body: createCameraSchema }),
  async (req: Request, res: Response) => {
    const existing = await Camera.findOne({ id: req.body.id });
    if (existing) {
      return sendError(res, `Camera with id '${req.body.id}' already exists`, 409);
    }

    const camera = await Camera.create(req.body);
    return sendSuccess(res, camera, 'Camera created successfully', undefined, 201);
  }
);

// PATCH /cameras/:id - update camera (Admin only)
camerasRouter.patch(
  '/:id',
  requireRoles(['Admin']),
  validateRequest({ body: patchCameraSchema }),
  async (req: Request, res: Response) => {
    const camera = await Camera.findOneAndUpdate(
      { id: req.params.id },
      { $set: req.body },
      { new: true }
    ).lean();

    if (!camera) {
      return sendError(res, `Camera with id '${req.params.id}' not found`, 404);
    }
    return sendSuccess(res, camera, 'Camera updated successfully');
  }
);
