import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import expenseRoutes from './routes/expenseRoutes';
import complianceRoutes from './routes/complianceRoutes';
import vehicleRoutes from './routes/vehicleRoutes';
import documentRoutes from './routes/documentRoutes';
import path from 'path';
import fs from 'fs';

dotenv.config();

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static(uploadsDir));

// Routes
app.use('/api/expenses', expenseRoutes);
app.use('/api/compliance', complianceRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/documents', documentRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'vehicle-exp-backend' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
