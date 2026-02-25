import { Router } from 'express';
import { getMetrics } from '../controllers/metricsController';

const router = Router();

export const requireAdmin = (req: any, res: any, next: any) => {
    if (req.user && req.user.role === 'ADMIN') {
        next();
    } else {
        res.status(403).json({ error: 'Access denied' });
    }
};

router.get('/', requireAdmin, getMetrics);

export default router;
