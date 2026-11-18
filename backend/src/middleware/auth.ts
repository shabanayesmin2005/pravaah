import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UserRole } from '../models/user.model';
import { sendError } from '../utils/response';

export interface AuthUser {
  user_id: string;
  email: string;
  role: UserRole;
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendError(res, 'Authentication required. Missing Bearer token.', 401);
    return;
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    sendError(res, 'Authentication token missing.', 401);
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as AuthUser;
    req.user = {
      user_id: decoded.user_id,
      email: decoded.email,
      role: decoded.role,
      name: decoded.name,
    };
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      sendError(res, 'Token has expired.', 401);
      return;
    }
    sendError(res, 'Invalid or malformed authentication token.', 401);
  }
}
