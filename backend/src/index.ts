import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import expenseRoutes from './routes/expenseRoutes';
import complianceRoutes from './routes/complianceRoutes';
import vehicleRoutes from './routes/vehicleRoutes';
import documentRoutes from './routes/documentRoutes';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3000;

// Resilience: uploads folder
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static(uploadsDir));

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

// SELF-HEALING STARTUP
async function startServer() {
  console.log('Connecting to database...');
  let retries = 5;
  while (retries > 0) {
    try {
      await prisma.$connect();
      console.log('Successfully connected to database.');
      break;
    } catch (err) {
      retries -= 1;
      console.error(`Database connection failed. Retries left: ${retries}`, err);
      if (retries === 0) {
        console.error('COULD NOT CONNECT TO DATABASE. SHUTTING DOWN.');
        process.exit(1);
      }
      await new Promise(res => setTimeout(res, 2000));
    }
  }

  app.listen(PORT, () => {
    console.log(`v1.0.4 Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('FAILED TO START APP:', err);
  process.exit(1);
});

// Panic handlers
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION AT:', promise, 'REASON:', reason);
});
