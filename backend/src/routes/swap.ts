import { Router } from 'express';
import { SwapController } from '../controllers/swapController';
import { WalletService } from '../services/walletService';
import { PrivacyService } from '../services/privacyService';
import { EnhancedPrivacyService } from '../services/enhancedPrivacyService';

const router = Router();

// Initialize services
// Use enhanced privacy service (inspired by Elusiv) by default
const USE_ENHANCED_PRIVACY = process.env.USE_ENHANCED_PRIVACY !== 'false';
const walletService = new WalletService();
const privacyService = USE_ENHANCED_PRIVACY 
  ? new EnhancedPrivacyService(walletService)
  : new PrivacyService(walletService);
const swapController = new SwapController(walletService, privacyService);

// Routes
router.post('/prepare', (req, res) => swapController.prepareSwap(req, res));
router.post('/initiate', (req, res) => swapController.initiateSwap(req, res));
router.get('/status/:transactionId', (req, res) => swapController.getSwapStatus(req, res));
router.get('/intermediate/:walletId', (req, res) => swapController.getIntermediateWallet(req, res));
router.get('/config', (req, res) => swapController.getConfig(req, res));
router.get('/recovery/:transactionId', (req, res) => swapController.checkRecovery(req, res));
router.post('/recovery/:transactionId', (req, res) => swapController.executeRecovery(req, res));
router.get('/memo/:transactionId', (req, res) => swapController.getEncryptedMemo(req, res));

export { router as swapRoutes };

