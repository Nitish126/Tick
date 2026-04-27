import { Router } from 'express';
import { registerUser, loginUser, loginWithGoogle, loginWithApple } from '../controllers/authController';

const router = Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/google', loginWithGoogle);
router.post('/apple', loginWithApple);

export default router;
