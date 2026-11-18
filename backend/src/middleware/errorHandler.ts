import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { sendError } from '../utils/response';

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const status = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';

  if (env.NODE_ENV !== 'test') {
    console.error('Unhandled Server Error:', err);
  }

  sendError(
    res,
    message,
    status,
    env.NODE_ENV === 'development' ? { stack: err.stack } : undefined
  );
}
