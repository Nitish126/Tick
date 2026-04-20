import { Router } from 'express';
import { getCompliance, checkChallan } from '../controllers/complianceController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();
router.use(authenticate);

router.get('/:vehicleId', getCompliance);
router.post('/check-challan', checkChallan);

export default router;
