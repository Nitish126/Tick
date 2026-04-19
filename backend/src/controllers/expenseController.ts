import { Request, Response } from 'express';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const prisma = new PrismaClient();
const ENGINE_URL = process.env.ENGINE_URL || 'http://127.0.0.1:8000';

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

export const scanBill = async (req: Request, res: Response) => {
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
    
    // 2. Map vehicle
    let activeVehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!activeVehicle) {
      return res.status(404).json({ success: false, error: 'Select a valid vehicle before scanning.' });
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
    console.error('OCR Error:', error?.response?.data || error);
    return res.status(500).json({ error: 'Failed to process bill or vault database.' });
  }
};

export const manualLog = async (req: Request, res: Response) => {
  try {
    const { vehicleId, merchant, amount, date, category, image_base64, odometer, selectedServices } = req.body;
    
    let activeVehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!activeVehicle) return res.status(404).json({ success: false, error: 'Invalid Vehicle' });

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

export const getExpenses = async (req: Request, res: Response) => {
  try {
    const { vehicleId } = req.params;
    const scopedUser = (req.headers['x-user-id'] as string) || 'test-user-id';
    
    let expenses;
    if (vehicleId === 'all' || vehicleId === 'default') {
      expenses = await prisma.expense.findMany({
        where: { vehicle: { users: { some: { userId: scopedUser } } } },
        orderBy: { date: 'desc' },
        include: { vehicle: true }
      });
    } else {
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

export const patchExpense = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { odometer } = req.body;
    
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
