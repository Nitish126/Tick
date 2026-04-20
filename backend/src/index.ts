import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import expenseRoutes from './routes/expenseRoutes';
import complianceRoutes from './routes/complianceRoutes';
import vehicleRoutes from './routes/vehicleRoutes';
import documentRoutes from './routes/documentRoutes';
import path from 'path';
import fs from 'fs';
import { prisma } from './prisma';

const app = express();
const PORT = process.env.PORT || 3000;
// Singleton prisma from ./prisma used globally

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// SAFE ASYNC INITIALIZATION
const initFolders = () => {
  try {
    const uploadsDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    app.use('/uploads', express.static(uploadsDir));
    console.log('Uploads directory ready.');
  } catch (err) {
    console.error('Warning: Could not initialize uploads directory', err);
  }
};

// Routes
app.use('/api/expenses', expenseRoutes);
app.use('/api/compliance', complianceRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/documents', documentRoutes);

app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'OK', database: 'CONNECTED', service: 'vehicle-exp-backend' });
  } catch (e: any) {
    res.status(503).json({ status: 'ERROR', database: 'DISCONNECTED', error: e.message });
  }
});

// GLOBAL ERROR HANDLER
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('SERVER ERROR:', err.stack);
  res.status(500).json({ success: false, error: 'Internal Server Error', details: err.message });
});

// IMMEDIATE LISTENING (To prevent Railway 502 timeouts)
app.listen(PORT, () => {
  console.log(`v1.0.4 Server immediately listening on port ${PORT}`);
  initFolders();
});

// ASYNC DB CONNECTION
async function connectToDatabase() {
  console.log('Connecting to database in background...');
  let retries = 10;
  while (retries > 0) {
    try {
      await prisma.$connect();
      console.log('Successfully connected to database.');
      return;
    } catch (err) {
      retries -= 1;
      console.error(`Database connection failed. Retries left: ${retries}`, err);
      await new Promise(res => setTimeout(res, 5000));
    }
  }
  console.error('CRITICAL: FAILED TO CONNECT TO DATABASE AFTER MULTIPLE RETRIES.');
}

connectToDatabase().catch(err => {
  console.error('BACKGROUND DB CONNECTION ERROR:', err);
});

// Panic handlers
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION AT:', promise, 'REASON:', reason);
});
