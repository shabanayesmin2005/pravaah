import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

export const globalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.',
  },
  skip: (req) => {
    // Skip rate limiting in test environment or for health checks
    return process.env.NODE_ENV === 'test' || req.path === '/api/v1/health';
  },
});
