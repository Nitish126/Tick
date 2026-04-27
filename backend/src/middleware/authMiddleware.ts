import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_dev';

export interface AuthRequest extends Request {
  user?: any;
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const legacyUserId = req.headers['x-user-id'];

  // 1. Bearer Token Check (Modern JWT Auth)
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1];
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      const user = await prisma.user.findUnique({ where: { id: decoded.id } });

      if (!user) {
        return res.status(401).json({ success: false, error: 'User not found' });
      }

      req.user = user;
      return next();
    } catch (error) {
      console.error('JWT Verification Error:', error);
      return res.status(401).json({ success: false, error: 'Invalid or expired identity token.' });
    }
  }

  // 2. Legacy / Dev Fallback (For current local testing)
  // We allow x-user-id header ONLY in dev environment to prevent breaking current flow
  if (process.env.NODE_ENV !== 'production' && legacyUserId) {
    let user = await prisma.user.findFirst({ where: { id: legacyUserId as string } });
    if (!user) {
        // Auto-provision for local dev if missing
        user = await prisma.user.create({
            data: { 
                id: legacyUserId as string, 
                email: `${legacyUserId}@motokeeper.dev`,
                name: 'Guest Driver'
            }
        });
    }
    req.user = user;
    return next();
  }

  return res.status(401).json({ success: false, error: 'Authentication required. Please sign in.' });
};
