import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getProfile, updateProfile, changePassword, getAllUsers } from '../controllers/userController';

const router = Router();

// Strict rate limit for password change: 5 attempts per 15 minutes per IP
const passwordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many password change attempts. Try again in 15 minutes.' },
});

// Routes are mounted at /api/users and already have authenticateToken applied
router.get('/', getAllUsers);
router.get('/me', getProfile);
router.put('/profile', updateProfile);
router.put('/password', passwordChangeLimiter, changePassword);

export default router;
