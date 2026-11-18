import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env';
import { User, IUser } from '../models/user.model';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import { logAudit } from '../services/audit.service';
import { sendSuccess, sendError } from '../utils/response';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() || req.ip || 'unknown';
  }
  return req.ip || 'unknown';
}

function generateTokens(user: IUser) {
  const payload = {
    user_id: user.user_id,
    email: user.email,
    role: user.role,
    name: user.name,
  };

  const accessToken = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as any,
  });

  const refreshToken = jwt.sign(
    { user_id: user.user_id, email: user.email },
    env.JWT_REFRESH_SECRET,
    {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN as any,
    }
  );

  return { accessToken, refreshToken };
}

// POST /auth/login
authRouter.post(
  '/login',
  validateRequest({ body: loginSchema }),
  async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const ip = getClientIp(req);

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      await logAudit({
        email,
        action: 'LOGIN_FAILED',
        ip,
        details: { reason: 'User not found' },
      });
      return sendError(res, 'Invalid email or password', 401);
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      await logAudit({
        userId: user.user_id,
        email: user.email,
        role: user.role,
        action: 'LOGIN_FAILED',
        ip,
        details: { reason: 'Password mismatch' },
      });
      return sendError(res, 'Invalid email or password', 401);
    }

    const tokens = generateTokens(user);

    await logAudit({
      userId: user.user_id,
      email: user.email,
      role: user.role,
      action: 'LOGIN_SUCCESS',
      ip,
    });

    return sendSuccess(res, {
      user: {
        id: user.user_id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      tokens,
    });
  }
);

// POST /auth/refresh
authRouter.post(
  '/refresh',
  validateRequest({ body: refreshSchema }),
  async (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    try {
      const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as {
        user_id: string;
        email: string;
      };

      const user = await User.findOne({ user_id: decoded.user_id });
      if (!user) {
        return sendError(res, 'User no longer exists', 401);
      }

      const tokens = generateTokens(user);
      return sendSuccess(res, { tokens });
    } catch {
      return sendError(res, 'Invalid or expired refresh token', 401);
    }
  }
);

// POST /auth/logout
authRouter.post('/logout', authenticate, async (req: Request, res: Response) => {
  const ip = getClientIp(req);
  if (req.user) {
    await logAudit({
      userId: req.user.user_id,
      email: req.user.email,
      role: req.user.role,
      action: 'LOGOUT',
      ip,
    });
  }
  return sendSuccess(res, { message: 'Logged out successfully' });
});

// GET /auth/me
authRouter.get('/me', authenticate, async (req: Request, res: Response) => {
  const user = await User.findOne({ user_id: req.user?.user_id }).select('-password_hash');
  if (!user) {
    return sendError(res, 'User not found', 404);
  }
  return sendSuccess(res, { user });
});
