import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { redis } from '../lib/redis';
import { checkKafkaHealth } from '../lib/kafka';
import { sendSuccess } from '../utils/response';

export const healthRouter = Router();

// GET /health - checks database, redis, and kafka connectivity
healthRouter.get('/', async (_req: Request, res: Response) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

  let redisStatus = 'disconnected';
  try {
    const pong = await redis.ping();
    if (pong === 'PONG') redisStatus = 'connected';
  } catch {
    redisStatus = 'error';
  }

  let kafkaStatus = 'disconnected';
  try {
    const isKafkaUp = await checkKafkaHealth();
    kafkaStatus = isKafkaUp ? 'connected' : 'disconnected';
  } catch {
    kafkaStatus = 'error';
  }

  const isHealthy = mongoStatus === 'connected' && redisStatus === 'connected';

  const responsePayload = {
    status: isHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      mongodb: mongoStatus,
      redis: redisStatus,
      kafka: kafkaStatus,
    },
  };

  return sendSuccess(res, responsePayload, undefined, undefined, isHealthy ? 200 : 503);
});
