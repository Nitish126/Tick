import { Router } from 'express';
import { createVehicle, getMyVehicles, addCollaborator, getVehicleById, updateVehicle, deleteVehicle } from '../controllers/vehicleController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();
router.use(authenticate);

router.post('/', createVehicle);
router.get('/my-fleet', getMyVehicles);
router.get('/:id', getVehicleById);
router.post('/:id/collaborators', addCollaborator);
router.put('/:id', updateVehicle);
router.delete('/:id', deleteVehicle);

export default router;
