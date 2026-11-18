import Redis from 'ioredis';
import { env } from '../config/env';

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 5) return null;
    return Math.min(times * 200, 2000);
  },
  lazyConnect: true,
});

redis.on('error', (err) => {
  // Avoid unhandled rejection on connection failure
  if (process.env.NODE_ENV !== 'test') {
    console.error('Redis Client Error:', err.message);
  }
});

export async function connectRedis(): Promise<Redis> {
  if (redis.status === 'wait') {
    await redis.connect();
  }
  return redis;
}

export async function disconnectRedis(): Promise<void> {
  if (redis.status === 'ready' || redis.status === 'connecting') {
    await redis.quit();
  }
}
