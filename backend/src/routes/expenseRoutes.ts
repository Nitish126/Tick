import { Router } from 'express';
import { scanBill, manualLog, getExpenses, patchExpense } from '../controllers/expenseController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();
router.use(authenticate);

router.post('/scan', scanBill);
router.post('/manual', manualLog);
router.get('/all', (req: any, res: any) => {
    req.params.vehicleId = 'all';
    return getExpenses(req, res);
});
router.get('/:vehicleId', getExpenses);
router.patch('/:id', patchExpense);

export default router;
