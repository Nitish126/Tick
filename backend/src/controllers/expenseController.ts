import { Response } from 'express';
import axios from 'axios';
import { prisma } from '../prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Shared prisma instance
const ENGINE_URL = process.env.ENGINE_URL || 'https://virtuous-rejoicing-production.up.railway.app';

const saveBase64Image = (base64String: string) => {
  if (!base64String) return null;
  try {
    const filename = `${crypto.randomUUID()}.jpg`;
    const filepath = path.join(__dirname, '../../uploads', filename);
    const base64Data = base64String.replace(/^data:image\/\w+;base64,/, "");
    fs.writeFileSync(filepath, base64Data, 'base64');
    return `/uploads/${filename}`;
  } catch (err) {
    console.error("Error saving image", err);
    return null;
  }
}

export const scanBill = async (req: AuthRequest, res: Response) => {
  try {
    const { image_base64, vehicleId } = req.body;
    
    if (!image_base64) {
      return res.status(400).json({ error: 'Missing imageBase64 payload.' });
    }

    // 1. Get parsed data from Engine
    const engineResponse = await axios.post(`${ENGINE_URL}/api/ocr/process`, {
      image_base64: image_base64
    });

    const parsedData = engineResponse.data;
    
    // 2. Map vehicle and check access
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const userId = req.user.id;

    let activeVehicle = await prisma.vehicle.findUnique({ 
      where: { id: vehicleId },
      include: { users: { where: { userId } } }
    });
    
    if (!activeVehicle || activeVehicle.users.length === 0) {
      return res.status(404).json({ success: false, error: 'Vehicle not found or access denied.' });
    }

    // 3. Keep Vault copy natively
    const savedReceiptUrl = saveBase64Image(image_base64);

    // 4. Save purely to SQLite
    const newExpense = await prisma.expense.create({
      data: {
        vehicleId: activeVehicle.id,
        date: new Date(parsedData.date),
        amount: parsedData.total_amount,
        merchant: parsedData.merchant,
        lineItems: JSON.stringify(parsedData.line_items),
        receiptUrl: savedReceiptUrl,
        mwuImpact: 0.0
      }
    });

    return res.json({
      success: true,
      message: 'Bill scanned and vaulted successfully',
      data: { ...parsedData, dbId: newExpense.id },
    });
  } catch (error: any) {
    if (error.response?.status === 429) {
       return res.status(429).json({ error: 'AI OCR Quota Exhausted. Please retry later or upgrade to a paid tier.' });
    }
    console.error('OCR Error:', error?.response?.data || error);
    return res.status(500).json({ error: 'Failed to process bill or vault database.' });
  }
};

export const manualLog = async (req: AuthRequest, res: Response) => {
  try {
    const { vehicleId, merchant, amount, date, category, image_base64, odometer, selectedServices } = req.body;
    
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const userId = req.user.id;

    let activeVehicle = await prisma.vehicle.findUnique({ 
      where: { id: vehicleId },
      include: { users: { where: { userId } } }
    });
    
    if (!activeVehicle || activeVehicle.users.length === 0) {
      return res.status(404).json({ success: false, error: 'Vehicle not found or access denied.' });
    }

    let savedReceiptUrl = null;
    if (image_base64) {
      savedReceiptUrl = saveBase64Image(image_base64);
    }

    let lineItemsMap: any[] = [];
    if (selectedServices && selectedServices.length > 0) {
      lineItemsMap = selectedServices.map((srv: string) => ({
        description: srv,
        total: 0,
        mechanical_impact_flag: true
      }));
      if (amount && parseFloat(amount) > 0) {
        lineItemsMap.push({
          description: 'Total Service Cost',
          total: parseFloat(amount),
          mechanical_impact_flag: false
        });
      }
    } else {
      lineItemsMap = [{
        description: `${category} Service`,
        total: parseFloat((amount || "0").toString()),
        mechanical_impact_flag: category === 'REPAIR' 
      }];
    }

    const odoNum = odometer ? parseInt(odometer) : null;

    const newExpense = await prisma.expense.create({
      data: {
        vehicleId: activeVehicle.id,
        date: new Date(date),
        amount: parseFloat((amount || "0").toString()),
        merchant: merchant || 'Manual Entry',
        lineItems: JSON.stringify(lineItemsMap),
        receiptUrl: savedReceiptUrl,
        odometer: odoNum,
        mwuImpact: category === 'REPAIR' ? 0.0 : 0.0 
      }
    });

    if (odoNum && odoNum > activeVehicle.odometer) {
       await prisma.vehicle.update({ where: { id: activeVehicle.id }, data: { odometer: odoNum }});
    }

    return res.json({ success: true, data: newExpense });
  } catch (error: any) {
    console.error("Manual Log error:", error);
    res.status(500).json({ success: false, error: 'Failed to save manual log' });
  }
}

export const getExpenses = async (req: AuthRequest, res: Response) => {
  try {
    const { vehicleId } = req.params;
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const userId = req.user.id;
    
    let expenses;
    if (vehicleId === 'all' || vehicleId === 'default') {
      expenses = await prisma.expense.findMany({
        where: { vehicle: { users: { some: { userId } } } },
        orderBy: { date: 'desc' },
        include: { vehicle: true }
      });
    } else {
      // Check access for specific vehicle
      const access = await prisma.userVehicleAccess.findUnique({
        where: { userId_vehicleId: { userId, vehicleId } }
      });
      if (!access) return res.status(403).json({ success: false, error: 'Forbidden' });

      expenses = await prisma.expense.findMany({
        where: { vehicleId },
        orderBy: { date: 'desc' },
        include: { vehicle: true }
      });
    }

    const formattedData = expenses.map(item => ({
      ...item,
      lineItems: JSON.parse(item.lineItems as string)
    }));

    res.json({ success: true, data: formattedData });
  } catch (error: any) {
    console.error("Fetch expenses error:", error);
    res.status(500).json({ success: false, error: 'Failed to fetch expenses' });
  }
};

export const patchExpense = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { odometer } = req.body;

    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const userId = req.user.id;

    // Find expense and verify vehicle access
    const expense = await prisma.expense.findUnique({
      where: { id },
      include: { vehicle: { include: { users: { where: { userId } } } } }
    });

    if (!expense || expense.vehicle.users.length === 0) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    
    const odoNum = odometer ? parseInt(odometer) : null;
    if (!odoNum) return res.json({ success: true, message: 'Nothing to update' });
    
    const updatePayload: any = { odometer: odoNum };

    const updated = await prisma.expense.update({
       where: { id },
       data: updatePayload
    });

    // Check if we need to bump the vehicle overall milage
    if (odoNum) {
       const v = await prisma.vehicle.findUnique({ where: { id: updated.vehicleId }});
       if (v && odoNum > v.odometer) {
          await prisma.vehicle.update({ where: { id: v.id }, data: { odometer: odoNum } });
       }
    }

    res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("Patch error", error);
    res.status(500).json({ success: false, error: 'Failed to update expense properties' });
  }
};
