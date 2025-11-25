import { Request, Response } from 'express';
import { PublicKey } from '@solana/web3.js';
import * as crypto from 'crypto';
import { WalletService } from '../services/walletService';
import { PrivacyService } from '../services/privacyService';
import { EnhancedPrivacyService } from '../services/enhancedPrivacyService';
import { RecoveryService } from '../services/recoveryService';
import { EncryptionService } from '../services/encryptionService';
import { connection } from '../config/solana';
import { 
  MIN_SWAP_AMOUNT, 
  MAX_SWAP_AMOUNT, 
  RELAYER_FEE_PERCENTAGE, 
  RELAYER_FEE_WALLET,
  getConfigHash,
  MAX_MIXING_NOTES,
  DEFAULT_MIXING_NOTES,
  EMERGENCY_RECOVERY_THRESHOLD,
  RECOVERY_FALLBACK_BLOCKS
} from '../config/constants';

export class SwapController {
  private walletService: WalletService;
  private privacyService: PrivacyService | EnhancedPrivacyService;
  private recoveryService: RecoveryService;

  constructor(walletService: WalletService, privacyService: PrivacyService | EnhancedPrivacyService) {
    this.walletService = walletService;
    this.privacyService = privacyService;
    this.recoveryService = new RecoveryService(walletService);
  }

  /**
   * POST /api/swap/prepare
   * Prepare a swap by generating an intermediate wallet
   */
  async prepareSwap(req: Request, res: Response) {
    try {
      const { sourceWallet, destinationWallet, amount } = req.body;

      // Validate input
      if (!sourceWallet || !destinationWallet || !amount) {
        return res.status(400).json({ 
          error: 'Missing required fields: sourceWallet, destinationWallet, amount' 
        });
      }

      // Validate wallet addresses
      try {
        new PublicKey(sourceWallet);
        new PublicKey(destinationWallet);
      } catch (error) {
        return res.status(400).json({ error: 'Invalid wallet address format' });
      }

      // Validate amount
      const amountNum = parseFloat(amount);
      
      if (isNaN(amountNum) || amountNum <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
      }
      
      if (amountNum < MIN_SWAP_AMOUNT) {
        return res.status(400).json({ 
          error: `Minimum swap amount is ${MIN_SWAP_AMOUNT} SOL` 
        });
      }
      
      if (MAX_SWAP_AMOUNT !== null && amountNum > MAX_SWAP_AMOUNT) {
        return res.status(400).json({ 
          error: `Maximum swap amount is ${MAX_SWAP_AMOUNT} SOL` 
        });
      }

      // Calculate relayer fee
      const relayerFee = amountNum * RELAYER_FEE_PERCENTAGE;
      const amountAfterFee = amountNum - relayerFee;

      // Generate intermediate wallet
      const intermediateWallet = await this.walletService.generateIntermediateWallet();

      // Generate recovery key for emergency recovery (client should store this)
      const recoveryKey = crypto.randomBytes(32).toString('hex');
      const recoveryKeyHash = crypto.createHash('sha256').update(recoveryKey).digest('hex');

      res.json({
        success: true,
        intermediateWallet: {
          publicKey: intermediateWallet.publicKey,
          walletId: intermediateWallet.walletId,
        },
        fee: {
          relayerFee: relayerFee,
          relayerFeePercentage: RELAYER_FEE_PERCENTAGE * 100,
          amountAfterFee: amountAfterFee,
          depositFee: 0, // 0% deposit fee (competitive advantage)
        },
        mixing: {
          maxNotes: MAX_MIXING_NOTES,
          defaultNotes: DEFAULT_MIXING_NOTES,
          noteCapacity: '6-8 notes per transaction',
        },
        recovery: {
          recoveryKey: recoveryKey, // Client must store this securely
          recoveryKeyHash: recoveryKeyHash, // Server stores hash only
          threshold: EMERGENCY_RECOVERY_THRESHOLD,
          note: `After ${EMERGENCY_RECOVERY_THRESHOLD} deposits by other users, you can recover directly without relayer.`,
        },
        config: {
          configHash: getConfigHash(), // Allows verification of immutable config
          immutable: true,
          note: 'All fees and limits are hardcoded and cannot be changed.',
        },
        instructions: {
          step1: `Send ${amount} SOL from ${sourceWallet} to ${intermediateWallet.publicKey}`,
          step2: 'After sending, call /api/swap/initiate with the transaction signature',
          step3: 'Store your recovery key securely - you will need it for emergency recovery',
          note: `Relayer fee of ${relayerFee.toFixed(8)} SOL (${(RELAYER_FEE_PERCENTAGE * 100).toFixed(2)}%) will be deducted. Destination will receive ${amountAfterFee.toFixed(8)} SOL.`,
        },
      });
    } catch (error: any) {
      console.error('Error preparing swap:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * POST /api/swap/initiate
   * Initiate a private swap after user sends funds to intermediate wallet
   */
  async initiateSwap(req: Request, res: Response) {
    try {
      const { sourceWallet, destinationWallet, amount, sourceTxSignature, intermediateWalletId } = req.body;

      // Validate input
      if (!sourceWallet || !destinationWallet || !amount || !sourceTxSignature || !intermediateWalletId) {
        return res.status(400).json({ 
          error: 'Missing required fields: sourceWallet, destinationWallet, amount, sourceTxSignature, intermediateWalletId' 
        });
      }

      // Validate wallet addresses
      try {
        new PublicKey(sourceWallet);
        new PublicKey(destinationWallet);
      } catch (error) {
        return res.status(400).json({ error: 'Invalid wallet address format' });
      }

      // Validate amount
      const amountNum = parseFloat(amount);
      
      if (isNaN(amountNum) || amountNum <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
      }
      
      if (amountNum < MIN_SWAP_AMOUNT) {
        return res.status(400).json({ 
          error: `Minimum swap amount is ${MIN_SWAP_AMOUNT} SOL` 
        });
      }
      
      if (MAX_SWAP_AMOUNT !== null && amountNum > MAX_SWAP_AMOUNT) {
        return res.status(400).json({ 
          error: `Maximum swap amount is ${MAX_SWAP_AMOUNT} SOL` 
        });
      }

      // Calculate relayer fee
      const relayerFee = amountNum * RELAYER_FEE_PERCENTAGE;
      const amountAfterFee = amountNum - relayerFee;

      // Verify source transaction
      const sourceTx = await connection.getTransaction(sourceTxSignature, {
        commitment: 'confirmed',
      });

      if (!sourceTx) {
        return res.status(400).json({ error: 'Source transaction not found or not confirmed' });
      }

      // Get recovery key from request (client-generated)
      const { recoveryKey, encryptedMemo } = req.body;
      
      // Create swap transaction record (store original amount, fee will be deducted during execution)
      const transactionId = await this.privacyService.createSwapTransaction(
        sourceWallet,
        destinationWallet,
        parseFloat(amount),
        intermediateWalletId,
        sourceTxSignature,
        relayerFee
      );

      // Initialize recovery tracking
      if (recoveryKey) {
        const recoveryKeyHash = require('crypto').createHash('sha256').update(recoveryKey).digest('hex');
        await this.recoveryService.initializeRecovery(transactionId, recoveryKeyHash);
      }

      // Store encrypted memo if provided (server is blind to contents)
      if (encryptedMemo && encryptedMemo.encrypted && encryptedMemo.metadata) {
        await EncryptionService.storeEncryptedMemo(
          transactionId,
          encryptedMemo.encrypted,
          encryptedMemo.metadata
        );
      }

      // Increment deposit counter for recovery tracking
      await this.recoveryService.incrementDepositCounter();

      res.json({
        success: true,
        transactionId,
        message: 'Swap initiated. The transaction will be processed automatically.',
        status: 'pending',
        recovery: {
          available: false,
          threshold: EMERGENCY_RECOVERY_THRESHOLD,
          note: `Emergency recovery will be available after ${EMERGENCY_RECOVERY_THRESHOLD} deposits by other users.`,
        },
      });
    } catch (error: any) {
      console.error('Error initiating swap:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * GET /api/swap/status/:transactionId
   * Get swap status
   */
  async getSwapStatus(req: Request, res: Response) {
    try {
      const { transactionId } = req.params;

      const status = await this.privacyService.getSwapStatus(transactionId);

      if (!status) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      res.json({
        success: true,
        transaction: status,
      });
    } catch (error: any) {
      console.error('Error getting swap status:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * GET /api/swap/intermediate/:walletId
   * Get intermediate wallet details
   */
  async getIntermediateWallet(req: Request, res: Response) {
    try {
      const { walletId } = req.params;

      const keypair = await this.walletService.getIntermediateWalletKeypair(walletId);
      const balance = await this.walletService.getBalance(keypair.publicKey.toString());

      res.json({
        success: true,
        wallet: {
          publicKey: keypair.publicKey.toString(),
          balance: balance,
        },
      });
    } catch (error: any) {
      console.error('Error getting intermediate wallet:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * GET /api/swap/config
   * Get immutable configuration (for verification)
   */
  async getConfig(req: Request, res: Response) {
    try {
      res.json({
        success: true,
        config: {
          relayerFeePercentage: RELAYER_FEE_PERCENTAGE * 100,
          depositFeePercentage: 0,
          minSwapAmount: MIN_SWAP_AMOUNT,
          maxSwapAmount: MAX_SWAP_AMOUNT,
          maxMixingNotes: MAX_MIXING_NOTES,
          defaultMixingNotes: DEFAULT_MIXING_NOTES,
          emergencyRecoveryThreshold: EMERGENCY_RECOVERY_THRESHOLD,
          recoveryFallbackBlocks: RECOVERY_FALLBACK_BLOCKS,
          configHash: getConfigHash(),
          immutable: true,
          note: 'This configuration is hardcoded and cannot be changed without code deployment.',
        },
      });
    } catch (error: any) {
      console.error('Error getting config:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * GET /api/swap/recovery/:transactionId
   * Check emergency recovery availability
   */
  async checkRecovery(req: Request, res: Response) {
    try {
      const { transactionId } = req.params;

      const recoveryStatus = await this.recoveryService.checkRecoveryAvailability(transactionId);

      res.json({
        success: true,
        recovery: recoveryStatus,
      });
    } catch (error: any) {
      console.error('Error checking recovery:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * POST /api/swap/recovery/:transactionId
   * Execute emergency recovery
   */
  async executeRecovery(req: Request, res: Response) {
    try {
      const { transactionId } = req.params;
      const { recoveryKey, destinationWallet } = req.body;

      if (!recoveryKey || !destinationWallet) {
        return res.status(400).json({ 
          error: 'Missing required fields: recoveryKey, destinationWallet' 
        });
      }

      // Validate destination wallet
      try {
        new PublicKey(destinationWallet);
      } catch (error) {
        return res.status(400).json({ error: 'Invalid destination wallet address format' });
      }

      const result = await this.recoveryService.executeRecovery(
        transactionId,
        recoveryKey,
        destinationWallet
      );

      if (!result.success) {
        return res.status(400).json({ 
          success: false,
          error: result.error 
        });
      }

      res.json({
        success: true,
        message: 'Emergency recovery executed successfully',
        txSignature: result.txSignature,
      });
    } catch (error: any) {
      console.error('Error executing recovery:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * GET /api/swap/memo/:transactionId
   * Get encrypted memo (server cannot decrypt)
   */
  async getEncryptedMemo(req: Request, res: Response) {
    try {
      const { transactionId } = req.params;

      const memo = await EncryptionService.getEncryptedMemo(transactionId);

      if (!memo) {
        return res.status(404).json({ error: 'Encrypted memo not found' });
      }

      res.json({
        success: true,
        memo: {
          encrypted: memo.encrypted,
          metadata: memo.metadata,
          note: 'Server cannot decrypt this data. Only you hold the decryption key.',
        },
      });
    } catch (error: any) {
      console.error('Error getting encrypted memo:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }
}

