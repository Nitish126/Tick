import { Request, Response } from 'express';
import { prisma } from '../prisma';

// Simplified to use shared prisma instance

async function ensureUser(headerId: any) {
  const resolvedId = (headerId as string) || 'test-user-id';
  let user = await prisma.user.findFirst({ where: { id: resolvedId }});
  if (!user) {
    user = await prisma.user.create({
      data: { id: resolvedId, email: `${resolvedId}@motokeeper.com`, name: `User ${resolvedId.substring(0,6)}`, role: 'USER' }
    });
  }
  return user.id;
}

export const createVehicle = async (req: Request, res: Response) => {
  try {
    const { registrationNo, make, model, color, odometer, vin } = req.body;
    const userId = await ensureUser(req.headers['x-user-id']);

    // Create standard Vehicle
    const newVehicle = await prisma.vehicle.create({
      data: {
        registrationNo: registrationNo || `UNKNOWN-${Date.now()}`,
        make,
        model,
        color: color || '#202E4E',
        odometer: parseInt(odometer) || 0,
      }
    });

    // Maker automatically is OWNER
    await prisma.userVehicleAccess.create({
      data: { userId, vehicleId: newVehicle.id, accessRole: 'OWNER' }
    });

    res.status(201).json({ success: true, data: newVehicle });
  } catch (error: any) {
    console.error('Create Vehicle Error:', error);
    
    // Explicitly handle Prisma Unique Constraint errors
    if (error.code === 'P2002') {
      return res.status(400).json({ 
        success: false, 
        error: 'Registration Number is already registered in MotoKeeper.' 
      });
    }

    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to create vehicle' 
    });
  }
};

export const getMyVehicles = async (req: Request, res: Response) => {
  try {
    const userId = await ensureUser(req.headers['x-user-id']);

    const myAccessList = await prisma.userVehicleAccess.findMany({
      where: { userId },
      include: {
        vehicle: {
          include: { 
            _count: { select: { expenses: true } },
            users: { where: { accessRole: 'OWNER' }, include: { user: { select: { name: true } } } },
            expenses: { orderBy: { date: 'desc' }, take: 10 }
          }
        }
      }
    });

    const output = myAccessList.map(item => {
      const vehicle = item.vehicle;
      const owner = vehicle.users[0]?.user.name || 'Owner';
      const history = vehicle.expenses;
      
      // Target: Latest "SERVICE" or "REPAIR" log
      const lastService = history.find(e => {
        const text = (e.merchant + ' ' + (e.lineItems || '')).toUpperCase();
        return text.includes('SERVICE') || text.includes('REPAIR') || text.includes('MAINTENANCE');
      });

      let score = 100;
      let status = 'OPTIMAL';

      if (lastService) {
        const odoAtService = lastService.odometer || 0;
        const dateAtService = new Date(lastService.date);
        const currentOdo = vehicle.odometer;
        const now = new Date();

        // 1. Distance Check (10,000 km interval)
        const odoDiff = currentOdo - odoAtService;
        if (odoDiff > 10000) {
          const over = odoDiff - 10000;
          score -= Math.floor(over / 200); // -5% per 1000km over
          status = 'SERVICE OVERDUE';
        }

        // 2. Time Check (1 year interval)
        const msPerMonth = 30 * 24 * 60 * 60 * 1000;
        const monthsDiff = (now.getTime() - dateAtService.getTime()) / msPerMonth;
        if (monthsDiff > 12) {
          const overMonths = monthsDiff - 12;
          score -= Math.floor(overMonths * 5); // -5% per month over
          status = 'TIME EXPIRED';
        }
      } else {
        // No history baseline
        score = 75;
        status = 'NO HISTORY';
      }
      
      return {
        id: vehicle.id,
        registrationNo: vehicle.registrationNo,
        make: vehicle.make,
        model: vehicle.model,
        color: vehicle.color,
        odometer: vehicle.odometer,
        currentMwu: vehicle.currentMwu,
        accessRole: item.accessRole,
        expenseCount: vehicle._count.expenses,
        activeDriver: owner,
        healthScore: Math.max(40, Math.floor(score)),
        healthStatus: status
      };
    });

    res.json({ success: true, data: output });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Fetch failed' });
  }
};

export const addCollaborator = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // vehicle id
    const { collaboratorId } = req.body;
    
    if (!collaboratorId) return res.status(400).json({ error: "Missing collaborator ID" });
    
    // Ensure collaborator exists
    await ensureUser(collaboratorId);
    
    // Check if link exists
    const existing = await prisma.userVehicleAccess.findUnique({
      where: { userId_vehicleId: { userId: collaboratorId, vehicleId: id } }
    });
    
    if (existing) {
       return res.json({ success: true, message: 'Already a collaborator' });
    }

    await prisma.userVehicleAccess.create({
       data: { userId: collaboratorId, vehicleId: id, accessRole: 'DRIVER' }
    });
    
    res.json({ success: true, message: 'Collaborator added successfully' });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Failed to add collaborator' });
  }
};

export const getVehicleById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = await ensureUser(req.headers['x-user-id']);

    // Check user has access to it
    const access = await prisma.userVehicleAccess.findUnique({
      where: { userId_vehicleId: { userId, vehicleId: id } }
    });

    if (!access) return res.status(403).json({ success: false, error: 'Forbidden' });

    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: {
        users: { include: { user: { select: { id: true, name: true } } } },
        expenses: { orderBy: { date: 'desc' } }
      }
    });

    res.json({ success: true, data: vehicle });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Failed to fetch vehicle' });
  }
};

export const updateVehicle = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = await ensureUser(req.headers['x-user-id']);
    const { make, model, color, odometer, registrationNo } = req.body;

    const access = await prisma.userVehicleAccess.findUnique({
      where: { userId_vehicleId: { userId, vehicleId: id } }
    });

    if (!access) return res.status(403).json({ success: false, error: 'Forbidden' });

    const data: any = {};
    if (make) data.make = make;
    if (model) data.model = model;
    if (color) data.color = color;
    if (odometer) data.odometer = parseInt(odometer);
    if (registrationNo) data.registrationNo = registrationNo;

    const updated = await prisma.vehicle.update({ where: { id }, data });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Update Vehicle Error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to update vehicle' });
  }
};

export const deleteVehicle = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = await ensureUser(req.headers['x-user-id']);

    const access = await prisma.userVehicleAccess.findUnique({
      where: { userId_vehicleId: { userId, vehicleId: id } }
    });

    if (!access || access.accessRole !== 'OWNER') {
      return res.status(403).json({ success: false, error: 'Must be OWNER to delete vehicle' });
    }

    await prisma.expense.deleteMany({ where: { vehicleId: id } });
    await prisma.compliance.deleteMany({ where: { vehicleId: id } });
    await prisma.userVehicleAccess.deleteMany({ where: { vehicleId: id } });
    await prisma.vehicle.delete({ where: { id } });

    res.json({ success: true, message: 'Vehicle deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to delete vehicle' });
  }
};
