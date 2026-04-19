import { Router } from 'express';
import { getCompliance, checkChallan } from '../controllers/complianceController';

const router = Router();

router.get('/:vehicleId', getCompliance);
router.post('/check-challan', checkChallan);

export default router;
