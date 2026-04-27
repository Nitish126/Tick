import { Response } from 'express';
import { prisma } from '../prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';



const saveBase64Image = (base64String: string) => {
  if (!base64String) return null;
  try {
    const filename = `doc-${crypto.randomUUID()}.jpg`;
    const filepath = path.join(__dirname, '../../uploads', filename);
    const base64Data = base64String.replace(/^data:image\/\w+;base64,/, "");
    fs.writeFileSync(filepath, base64Data, 'base64');
    return `/uploads/${filename}`;
  } catch (err) {
    console.error("Error saving document image", err);
    return null;
  }
}

export const uploadDocument = async (req: AuthRequest, res: Response) => {
  try {
    const { vehicleId } = req.params;
    const { type, title, image_base64, expiryDate } = req.body;

    if (!image_base64 || !type || !title) {
       return res.status(400).json({ success: false, error: 'Missing document payload' });
    }

    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const userId = req.user.id;

    // Verify vehicle access
    const access = await prisma.userVehicleAccess.findUnique({
        where: { userId_vehicleId: { userId, vehicleId } }
    });
    if (!access) return res.status(403).json({ success: false, error: 'Forbidden' });

    const fileUrl = saveBase64Image(image_base64);
    if (!fileUrl) {
       return res.status(500).json({ success: false, error: 'Failed to save document file' });
    }

    // Check if we should delete existing one of the same type? 
    // Usually for RC/Insurance, we replace.
    const existing = await prisma.document.findFirst({
        where: { vehicleId, type }
    });
    if (existing) {
        // Soft delete or actual delete of the old file
        try {
            const oldPath = path.join(__dirname, '../..', existing.fileUrl);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        } catch(e) {}
        
        await prisma.document.delete({ where: { id: existing.id } });
    }

    const document = await prisma.document.create({
      data: {
        vehicleId,
        type,
        title,
        fileUrl,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        status: 'ACTIVE'
      }
    });

    res.json({ success: true, data: document });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Failed to upload document' });
  }
};

export const getDocuments = async (req: AuthRequest, res: Response) => {
  try {
    const { vehicleId } = req.params;
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const userId = req.user.id;

    // Check access
    const access = await prisma.userVehicleAccess.findUnique({
        where: { userId_vehicleId: { userId, vehicleId } }
    });
    if (!access) return res.status(403).json({ success: false, error: 'Forbidden' });
    const documents = await prisma.document.findMany({
      where: { vehicleId },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: documents });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to fetch documents' });
  }
};

export const deleteDocument = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const userId = req.user.id;

    const doc = await prisma.document.findUnique({ 
        where: { id },
        include: { vehicle: { include: { users: { where: { userId } } } } }
    });
    
    if (!doc || doc.vehicle.users.length === 0) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    // Delete file
    try {
        const filePath = path.join(__dirname, '../..', doc.fileUrl);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch(e) {}

    await prisma.document.delete({ where: { id } });
    res.json({ success: true, message: 'Document deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to delete document' });
  }
};

export const getAllMyDocuments = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const userId = req.user.id;
    
    // Find all vehicles user has access to
    const accessList = await prisma.userVehicleAccess.findMany({
      where: { userId },
      select: { vehicleId: true }
    });
    const vehicleIds = accessList.map((a: any) => a.vehicleId);

    const documents = await prisma.document.findMany({
      where: { vehicleId: { in: vehicleIds } },
      include: { vehicle: { select: { make: true, model: true } } },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json({ success: true, data: documents });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Fleet fetch failed' });
  }
};
