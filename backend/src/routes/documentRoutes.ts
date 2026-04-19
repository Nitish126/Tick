import { Router } from 'express';
import { uploadDocument, getDocuments, deleteDocument, getAllMyDocuments } from '../controllers/documentController';

const router = Router();

router.get('/fleet/all', getAllMyDocuments);
router.get('/:vehicleId', getDocuments);
router.post('/:vehicleId', uploadDocument);
router.delete('/:id', deleteDocument);

export default router;
