import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../models/user.model';
import { sendError } from '../utils/response';
import { logAudit } from '../services/audit.service';

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() || req.ip || 'unknown';
  }
  return req.ip || 'unknown';
}

export function requireRoles(allowedRoles: UserRole[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      sendError(res, 'Authentication required before authorization check.', 401);
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      const route = req.originalUrl || req.url;
      const ip = getClientIp(req);

      // Audit log the 403 ACCESS_DENIED event
      await logAudit({
        userId: req.user.user_id,
        email: req.user.email,
        role: req.user.role,
        action: 'ACCESS_DENIED',
        target: route,
        ip,
        details: {
          route,
          method: req.method,
          attemptedRole: req.user.role,
          allowedRoles,
        },
      });

      if (req.user.role === 'Analyst') {
        sendError(
          res,
          'Access denied: Analyst role is restricted to aggregated analytics only; plate-level tracking is forbidden by privacy regulations.',
          403
        );
        return;
      }
      sendError(
        res,
        `Access denied. Role '${req.user.role}' is not authorized to access this resource.`,
        403
      );
      return;
    }

    next();
  };
}
