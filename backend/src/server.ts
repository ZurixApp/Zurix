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
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

// Request logging middleware (before routes)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - Origin: ${req.headers.origin || 'none'}`);
  next();
});

// Explicitly handle OPTIONS requests for all routes (before other routes)
app.options('*', (req, res) => {
  console.log(`OPTIONS request for ${req.path}`);
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

// Routes
app.use('/api/swap', swapRoutes);

// Test route to verify routing works
app.get('/api/test', (req, res) => {
  res.json({ message: 'API routing is working', timestamp: new Date().toISOString() });
});

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
    
    // Catch-all for undefined routes (after all routes)
    app.use((req, res) => {
      if (req.path.startsWith('/api/')) {
        console.log(`⚠️ Route not found: ${req.method} ${req.path}`);
        res.status(404).json({ 
          error: 'Route not found', 
          method: req.method, 
          path: req.path 
        });
      } else {
        res.status(404).json({ error: 'Not found' });
      }
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

