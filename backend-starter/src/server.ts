import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { swapRoutes } from './routes/swap';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/swap', swapRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
  console.log(`📡 Solana RPC: ${process.env.SOLANA_RPC_URL || 'Not configured'}`);
});

