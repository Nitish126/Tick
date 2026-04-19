import { Request, Response } from 'express';

export const getCompliance = async (req: Request, res: Response) => {
  return res.json({ data: { status: 'ACTIVE' } });
};

export const checkChallan = async (req: Request, res: Response) => {
  // Represents Background Task that queries Challan API
  return res.json({ success: true, challans: [] });
};
