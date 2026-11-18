import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load root .env file
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  BACKEND_PORT: z.coerce.number().default(4000),
  BACKEND_HOST: z.string().default('0.0.0.0'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 chars'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 chars'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  KAFKA_BROKERS: z.string().default('localhost:9092'),
  KAFKA_CLIENT_ID: z.string().default('pravaah-backend'),
  KAFKA_TOPIC_DETECTIONS: z.string().default('detections'),
  KAFKA_TOPIC_ALERTS: z.string().default('alerts'),
  KAFKA_TOPIC_ANALYTICS: z.string().default('analytics'),

  SNAPSHOT_DIR: z.string().default('backend/public/snapshots'),
  SNAPSHOT_BASE_URL: z.string().default('http://localhost:4000/snapshots'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  RETENTION_DAYS: z.coerce.number().default(90),
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:3000'),

  SEED_ADMIN_PASSWORD: z.string().default('Admin@Pravaah2026'),
  SEED_TRAFFIC_PASSWORD: z.string().default('Traffic@Pravaah2026'),
  SEED_POLICE_PASSWORD: z.string().default('Police@Pravaah2026'),
  SEED_ANALYST_PASSWORD: z.string().default('Analyst@Pravaah2026'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Environment validation failed:', parsed.error.format());
  throw new Error('Invalid environment variables. Check .env configuration.');
}

export const env = parsed.data;
