import { Router } from 'express';
import { getProfile, updateProfile, changePassword, getAllUsers } from '../controllers/userController';

const router = Router();

// Routes are mounted at /api/users and already have authenticateToken applied
router.get('/', getAllUsers);
router.get('/me', getProfile);
router.put('/profile', updateProfile);
router.put('/password', changePassword);

export default router;
