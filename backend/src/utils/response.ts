import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  pagination?: ApiResponse['pagination'],
  statusCode = 200
): Response {
  const response: ApiResponse<T> = {
    success: true,
    data,
    ...(message ? { message } : {}),
    ...(pagination ? { pagination } : {}),
  };
  return res.status(statusCode).json(response);
}

export function sendError(
  res: Response,
  error: string,
  statusCode = 400,
  details?: any
): Response {
  return res.status(statusCode).json({
    success: false,
    error,
    ...(details ? { details } : {}),
  });
}
