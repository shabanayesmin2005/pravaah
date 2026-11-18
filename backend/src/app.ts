import express, { Express, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'path';
import { env } from './config/env';
import { globalLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import { apiRouter } from './routes';
import { sendError } from './utils/response';

export const app: Express = express();

// Security HTTP headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS configuration
const allowedOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
        return callback(null, true);
      }
      return callback(new Error(`CORS policy does not allow access from ${origin}`));
    },
    credentials: true,
  })
);

// Rate limiter
app.use(globalLimiter);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static snapshots from SNAPSHOT_DIR at /snapshots
const snapshotAbsolutePath = path.isAbsolute(env.SNAPSHOT_DIR)
  ? env.SNAPSHOT_DIR
  : path.resolve(process.cwd(), env.SNAPSHOT_DIR);

app.use(
  '/snapshots',
  express.static(snapshotAbsolutePath, {
    maxAge: '1d',
    fallthrough: false,
  })
);

// Mount API routes under /api/v1
app.use('/api/v1', apiRouter);

// Root informational endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({
    project: 'PRAVAAH (प्रवाह)',
    version: '1.0.0',
    description: 'City-Wide AI Engine for ANPR Trajectory Tracking & Traffic Analytics',
    api_docs: '/api/v1',
    status: 'online',
  });
});

// 404 Catch-All
app.use((_req: Request, res: Response) => {
  sendError(res, 'Requested resource not found', 404);
});

// Global error handler
app.use(errorHandler);
