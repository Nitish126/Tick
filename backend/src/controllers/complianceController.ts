import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';

export const getCompliance = async (req: AuthRequest, res: Response) => {
  return res.json({ data: { status: 'ACTIVE' } });
};

export const checkChallan = async (req: AuthRequest, res: Response) => {
  // Represents Background Task that queries Challan API
  return res.json({ success: true, challans: [] });
};
