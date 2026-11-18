import { Router } from 'express';
import { authRouter } from './auth.routes';
import { camerasRouter } from './cameras.routes';
import { platesRouter } from './plates.routes';
import { vehiclesRouter } from './vehicles.routes';
import { alertsRouter } from './alerts.routes';
import { analyticsRouter } from './analytics.routes';
import { blacklistRouter } from './blacklist.routes';
import { auditRouter } from './audit.routes';
import { healthRouter } from './health.routes';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/cameras', camerasRouter);
apiRouter.use('/plates', platesRouter);
apiRouter.use('/vehicles', vehiclesRouter);
apiRouter.use('/alerts', alertsRouter);
apiRouter.use('/analytics', analyticsRouter);
apiRouter.use('/blacklist', blacklistRouter);
apiRouter.use('/audit-logs', auditRouter);
apiRouter.use('/health', healthRouter);
