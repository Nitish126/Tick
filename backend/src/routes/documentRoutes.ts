import { Router } from 'express';
import { uploadDocument, getDocuments, deleteDocument, getAllMyDocuments } from '../controllers/documentController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();
router.use(authenticate);

router.get('/fleet/all', getAllMyDocuments);
router.get('/:vehicleId', getDocuments);
router.post('/:vehicleId', uploadDocument);
router.delete('/:id', deleteDocument);

export default router;
