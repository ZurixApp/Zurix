import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { swapRoutes } from './routes/swap';
import { initializeDatabase } from './config/database';
import { TransactionMonitor } from './services/transactionMonitor';
import { WalletService } from './services/walletService';
import { PrivacyService } from './services/privacyService';
import { EnhancedPrivacyService } from './services/enhancedPrivacyService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Use enhanced privacy service (inspired by Elusiv) by default
// Set USE_ENHANCED_PRIVACY=false to use basic multi-hop routing
const USE_ENHANCED_PRIVACY = process.env.USE_ENHANCED_PRIVACY !== 'false';

// Middleware
// CORS configuration - allow frontend in production
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL || '*' // Allow specific frontend URL or all in production
    : '*', // Allow all in development
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

// Routes
app.use('/api/swap', swapRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    network: process.env.SOLANA_RPC_URL?.includes('devnet') ? 'devnet' : 'mainnet',
    privacyMode: USE_ENHANCED_PRIVACY ? 'enhanced' : 'basic',
  });
});

// Initialize server
async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();
    console.log('✅ Database initialized');

    // Start transaction monitor with enhanced privacy service
    const walletService = new WalletService();
    const privacyService = USE_ENHANCED_PRIVACY 
      ? new EnhancedPrivacyService(walletService)
      : new PrivacyService(walletService);
    const monitor = new TransactionMonitor(privacyService, walletService);
    monitor.startMonitoring(10000); // Check every 10 seconds
    
    console.log(`🔒 Privacy mode: ${USE_ENHANCED_PRIVACY ? 'Enhanced (Mixing Pool)' : 'Basic (Multi-Hop)'}`);

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Backend server running on port ${PORT}`);
      console.log(`📡 Solana RPC: ${process.env.SOLANA_RPC_URL || 'Not configured'}`);
      console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`\n📋 API Endpoints:`);
      console.log(`   GET  /health`);
      console.log(`   GET  /api/swap/config (immutable config verification)`);
      console.log(`   POST /api/swap/prepare`);
      console.log(`   POST /api/swap/initiate`);
      console.log(`   GET  /api/swap/status/:transactionId`);
      console.log(`   GET  /api/swap/intermediate/:walletId`);
      console.log(`   GET  /api/swap/recovery/:transactionId (check recovery)`);
      console.log(`   POST /api/swap/recovery/:transactionId (execute recovery)`);
      console.log(`   GET  /api/swap/memo/:transactionId (get encrypted memo)`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

