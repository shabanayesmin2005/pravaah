import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../models/user.model';
import { sendError } from '../utils/response';

export function requireRoles(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 'Authentication required before authorization check.', 401);
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
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
