import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import rfqRoutes from './routes/rfqRoutes.js';
import costingRoutes from './routes/costingRoutes.js';
import rateRoutes from './routes/rateRoutes.js';
import approvalRoutes from './routes/approvalRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import historicalRoutes from './routes/historicalRoutes.js';
import pdfRoutes from './routes/pdfRoutes.js';

dotenv.config();

export const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health Check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'Isocode RFQ-to-Quote Costing App',
    client: 'Isocode RFQ Costing',
    timestamp: new Date().toISOString(),
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/rfqs', rfqRoutes);
app.use('/api/costing', costingRoutes);
app.use('/api/rates', rateRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/historical', historicalRoutes);
app.use('/api/pdf', pdfRoutes);

// Global Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    error: 'Internal server error occurred',
    message: err.message || 'Unknown error',
  });
});

// Start server only when run directly (not during vitest testing)
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 Isocode RFQ Costing Server running on http://localhost:${PORT}`);
  });
}
