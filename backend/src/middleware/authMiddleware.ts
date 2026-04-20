import { Request, Response, NextFunction } from 'express';

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const userId = req.headers['x-user-id'];

  if (!userId) {
    return res.status(401).json({ 
      success: false, 
      error: 'Authentication failed: x-user-id header is missing.' 
    });
  }

  // Future authentication logic (JWT, DB check) can go here
  next();
};
