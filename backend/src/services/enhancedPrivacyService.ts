import * as crypto from 'crypto';
import { WalletService } from './walletService';
import { pool } from '../config/database';
import { markWalletAsUsed } from '../utils/keyManager';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { 
  RELAYER_FEE_WALLET, 
  RELAYER_FEE_PERCENTAGE,
  MAX_MIXING_NOTES,
  DEFAULT_MIXING_NOTES,
  MIN_MIXING_NOTES,
  MIXING_WINDOW_DURATION_MS,
  MIN_SPLIT_AMOUNT,
  OBFUSCATION_RANGE,
  EMERGENCY_RECOVERY_THRESHOLD,
  RECOVERY_FALLBACK_BLOCKS
} from '../config/constants';

export interface SwapStep {
  step: number;
  from: string;
  to: string;
  txSignature: string;
  timestamp: string;
  amount?: number;
}

export interface SwapResult {
  transactionId: string;
  steps: SwapStep[];
  status: string;
}

export interface MixingWindow {
  windowId: string;
  startTime: Date;
  endTime: Date;
  totalAmount: number;
  transactionCount: number;
}

/**
 * Enhanced Privacy Service inspired by Elusiv's mixing pool approach
 * 
 * Key improvements over basic multi-hop routing:
 * 1. Mixing Pool: Funds are deposited into a pool and withdrawn later, breaking direct links
 * 2. Amount Splitting: Large amounts are split into multiple smaller transactions
 * 3. Time-based Mixing Windows: Transactions are grouped in time windows for better mixing
 * 4. Amount Obfuscation: Small random amounts added/subtracted to break amount correlation
 * 5. Delayed Withdrawals: Random delays before withdrawal to mix with other transactions
 */
export class EnhancedPrivacyService {
  private walletService: WalletService;
  
  // Use immutable constants from config (these cannot be changed)
  private readonly MIXING_WINDOW_DURATION = MIXING_WINDOW_DURATION_MS;
  private readonly MIN_SPLIT_AMOUNT = MIN_SPLIT_AMOUNT;
  private readonly MAX_SPLITS = MAX_MIXING_NOTES; // Now supports up to 8 notes (competitive with 6-note systems)
  private readonly DEFAULT_SPLITS = DEFAULT_MIXING_NOTES; // Default 6 notes
  private readonly OBFUSCATION_RANGE = OBFUSCATION_RANGE;

  constructor(walletService: WalletService) {
    this.walletService = walletService;
  }

  /**
   * Execute a private swap using mixing pool approach
   * This provides much better privacy than simple multi-hop routing
   */
  async executePrivateSwap(
    sourceWallet: string,
    destinationWallet: string,
    amount: number,
    sourceTxSignature: string,
    intermediateWalletId: string
  ): Promise<SwapResult> {
    const transactionId = crypto.randomUUID();
    const steps: SwapStep[] = [];

    try {
      // Update transaction status to processing
      await this.updateTransactionStatus(transactionId, 'processing');

      // Step 1: Verify funds arrived in first intermediate wallet
      const firstIntermediate = await this.walletService.getIntermediateWalletKeypair(intermediateWalletId);
      const firstIntermediatePublicKey = firstIntermediate.publicKey.toString();
      
      const balance = await this.walletService.getBalance(firstIntermediatePublicKey);
      if (balance < amount) {
        throw new Error(`Insufficient balance in intermediate wallet. Expected ${amount} SOL, got ${balance} SOL`);
      }

      // Record initial deposit
      steps.push({
        step: 1,
        from: sourceWallet,
        to: firstIntermediatePublicKey,
        txSignature: sourceTxSignature,
        timestamp: new Date().toISOString(),
        amount: amount,
      });

      // Step 2: Intelligent 6-8 note mixing (competitive with 6-note systems, flexible up to 8)
      // Use intelligent splitting: larger amounts get more notes for better privacy
      const shouldSplit = amount > this.MIN_SPLIT_AMOUNT * 2;
      let targetNotes = this.DEFAULT_SPLITS; // Default 6 notes
      
      // Scale note count based on amount (up to MAX_SPLITS = 8)
      if (amount > 1.0) {
        targetNotes = Math.min(this.MAX_SPLITS, Math.floor(amount / 0.2)); // More notes for larger amounts
      } else if (amount > 0.5) {
        targetNotes = this.DEFAULT_SPLITS; // 6 notes for medium amounts (competitive)
      } else if (amount > 0.1) {
        targetNotes = Math.min(4, this.DEFAULT_SPLITS); // 4-6 notes for smaller amounts
      } else {
        targetNotes = MIN_MIXING_NOTES; // 2 notes minimum
      }
      
      const splits = shouldSplit ? this.calculateSplits(amount, targetNotes) : [amount];
      
      console.log(`🔀 ${splits.length}-note mixing: ${splits.map(s => s.toFixed(4)).join(', ')} SOL`);

      // Step 3: Get or create a mixing window
      const mixingWindow = await this.getOrCreateMixingWindow();
      
      // Step 4: Deposit each split into the mixing pool with delays
      const poolDeposits: Array<{ walletId: string; publicKey: string; amount: number }> = [];
      
      for (let i = 0; i < splits.length; i++) {
        const splitAmount = splits[i];
        
        // Generate intermediate wallet for this split (don't fund from treasury, fund from source)
        const intermediateWallet = await this.walletService.generateIntermediateWallet(false);
        
        // Fund the new intermediate wallet from the first one
        await this.walletService.fundIntermediateWalletFromSource(
          intermediateWalletId,
          new PublicKey(intermediateWallet.publicKey)
        );
        
        // Add randomized delay between splits (2-6 seconds)
        if (i > 0) {
          await this.addPrivacyDelay(2000, 6000);
        }

        // Transfer to intermediate wallet (this is the "deposit" into mixing pool)
        const depositSignature = await this.walletService.transferFromIntermediate(
          intermediateWalletId,
          intermediateWallet.publicKey,
          splitAmount
        );

        steps.push({
          step: 2 + i,
          from: firstIntermediatePublicKey,
          to: intermediateWallet.publicKey,
          txSignature: depositSignature,
          timestamp: new Date().toISOString(),
          amount: splitAmount,
        });

        poolDeposits.push({
          walletId: intermediateWallet.walletId,
          publicKey: intermediateWallet.publicKey,
          amount: splitAmount,
        });

        // Record deposit in mixing window
        await this.recordMixingDeposit(mixingWindow.windowId, intermediateWallet.publicKey, splitAmount);
      }

      // Mark first intermediate wallet as used
      await markWalletAsUsed(intermediateWalletId);

      // Step 5: Wait for mixing window to accumulate more transactions (mixing period)
      // This is key to the mixing pool approach - we wait for other transactions to mix with
      const mixingDelay = this.calculateMixingDelay(mixingWindow);
      console.log(`⏳ Waiting ${(mixingDelay / 1000).toFixed(1)}s for mixing window to accumulate transactions...`);
      await this.addPrivacyDelay(mixingDelay, mixingDelay + 10000);

      // Step 6: Withdraw from mixing pool with obfuscation
      // Each split is withdrawn separately with randomized delays and amount obfuscation
      const withdrawalWallets: Array<{ walletId: string; publicKey: string; amount: number }> = [];
      
      for (let i = 0; i < poolDeposits.length; i++) {
        const deposit = poolDeposits[i];
        
        // Generate new intermediate wallet for withdrawal (breaking the link)
        const withdrawalWallet = await this.walletService.generateIntermediateWallet(false);
        
        // Fund the withdrawal wallet from the deposit wallet
        await this.walletService.fundIntermediateWalletFromSource(
          deposit.walletId,
          new PublicKey(withdrawalWallet.publicKey)
        );
        
        // Apply amount obfuscation (add/subtract small random amount)
        const obfuscatedAmount = this.obfuscateAmount(deposit.amount);
        
        // Add randomized delay before withdrawal (5-15 seconds)
        await this.addPrivacyDelay(5000, 15000);

        // Transfer from deposit wallet to withdrawal wallet
        const withdrawalSignature = await this.walletService.transferFromIntermediate(
          deposit.walletId,
          withdrawalWallet.publicKey,
          obfuscatedAmount
        );

        const stepNumber = 2 + splits.length + i;
        steps.push({
          step: stepNumber,
          from: deposit.publicKey,
          to: withdrawalWallet.publicKey,
          txSignature: withdrawalSignature,
          timestamp: new Date().toISOString(),
          amount: obfuscatedAmount,
        });

        withdrawalWallets.push({
          walletId: withdrawalWallet.walletId,
          publicKey: withdrawalWallet.publicKey,
          amount: obfuscatedAmount,
        });

        // Mark deposit wallet as used
        await markWalletAsUsed(deposit.walletId);
      }

      // Step 7: Final routing to destination (with additional hops)
      // Use 1-2 additional hops before final destination
      const finalHops = Math.random() > 0.5 ? 2 : 1; // 50% chance of 2 hops
      let currentWalletId = withdrawalWallets[0].walletId;
      let currentPublicKey = withdrawalWallets[0].publicKey;
      let currentAmount = withdrawalWallets.reduce((sum, w) => sum + w.amount, 0);

      // If we have multiple withdrawals, combine them first
      if (withdrawalWallets.length > 1) {
        const combinedWallet = await this.walletService.generateIntermediateWallet(false);
        
        // Fund the combined wallet from the first withdrawal wallet
        await this.walletService.fundIntermediateWalletFromSource(
          withdrawalWallets[0].walletId,
          new PublicKey(combinedWallet.publicKey)
        );
        
        // Combine all withdrawals into one wallet
        for (let i = 1; i < withdrawalWallets.length; i++) {
          await this.addPrivacyDelay(3000, 8000);
          
          const combineSignature = await this.walletService.transferFromIntermediate(
            withdrawalWallets[i].walletId,
            combinedWallet.publicKey,
            withdrawalWallets[i].amount
          );

          steps.push({
            step: 2 + splits.length * 2 + i,
            from: withdrawalWallets[i].publicKey,
            to: combinedWallet.publicKey,
            txSignature: combineSignature,
            timestamp: new Date().toISOString(),
            amount: withdrawalWallets[i].amount,
          });

          await markWalletAsUsed(withdrawalWallets[i].walletId);
        }

        // Transfer first withdrawal to combined wallet
        await this.addPrivacyDelay(3000, 8000);
        const firstCombineSignature = await this.walletService.transferFromIntermediate(
          withdrawalWallets[0].walletId,
          combinedWallet.publicKey,
          withdrawalWallets[0].amount
        );

        steps.push({
          step: 2 + splits.length * 2,
          from: withdrawalWallets[0].publicKey,
          to: combinedWallet.publicKey,
          txSignature: firstCombineSignature,
          timestamp: new Date().toISOString(),
          amount: withdrawalWallets[0].amount,
        });

        await markWalletAsUsed(withdrawalWallets[0].walletId);
        
        currentWalletId = combinedWallet.walletId;
        currentPublicKey = combinedWallet.publicKey;
      }

      // Add final routing hops
      for (let hop = 0; hop < finalHops; hop++) {
        const hopWallet = await this.walletService.generateIntermediateWallet(false);
        
        // Fund the hop wallet from the current wallet
        await this.walletService.fundIntermediateWalletFromSource(
          currentWalletId,
          new PublicKey(hopWallet.publicKey)
        );
        
        await this.addPrivacyDelay(5000, 12000);

        const hopSignature = await this.walletService.transferFromIntermediate(
          currentWalletId,
          hopWallet.publicKey,
          currentAmount
        );

        steps.push({
          step: 2 + splits.length * 2 + withdrawalWallets.length + hop,
          from: currentPublicKey,
          to: hopWallet.publicKey,
          txSignature: hopSignature,
          timestamp: new Date().toISOString(),
          amount: currentAmount,
        });

        await markWalletAsUsed(currentWalletId);
        
        currentWalletId = hopWallet.walletId;
        currentPublicKey = hopWallet.publicKey;
      }

      // Step 8: Final transfer to destination (with relayer fee)
      await this.addPrivacyDelay(8000, 20000);

      // Get relayer fee from transaction record
      const transactionRecord = await pool.query(
        'SELECT relayer_fee FROM swap_transactions WHERE transaction_id = $1',
        [transactionId]
      );
      
      let relayerFee = 0;
      if (transactionRecord.rows.length > 0 && transactionRecord.rows[0].relayer_fee) {
        relayerFee = parseFloat(transactionRecord.rows[0].relayer_fee);
      } else {
        // Fallback: calculate fee if not stored
        relayerFee = currentAmount * RELAYER_FEE_PERCENTAGE;
      }
      
      const amountAfterFee = currentAmount - relayerFee;
      
      // Transfer to destination and relayer fee wallet (if configured)
      let finalTxSignature: string;
      if (RELAYER_FEE_WALLET && relayerFee > 0) {
        // Transfer to both destination and relayer wallet in one transaction
        finalTxSignature = await this.walletService.transferFromIntermediateMultiple(
          currentWalletId,
          [
            { destination: destinationWallet, amount: amountAfterFee },
            { destination: RELAYER_FEE_WALLET, amount: relayerFee },
          ]
        );
      } else {
        // If no relayer wallet configured, just send full amount to destination
        finalTxSignature = await this.walletService.transferFromIntermediate(
          currentWalletId,
          destinationWallet,
          currentAmount
        );
      }

      const finalStepNumber = 2 + splits.length * 2 + withdrawalWallets.length + finalHops;
      steps.push({
        step: finalStepNumber,
        from: currentPublicKey,
        to: destinationWallet,
        txSignature: finalTxSignature,
        timestamp: new Date().toISOString(),
        amount: amountAfterFee,
      });

      await markWalletAsUsed(currentWalletId);

      // Record withdrawal in mixing window
      await this.recordMixingWithdrawal(mixingWindow.windowId, destinationWallet, currentAmount);

      // Update transaction with final details
      await pool.query(
        `UPDATE swap_transactions 
         SET status = 'completed', 
             steps = $1, 
             final_tx_signature = $2,
             completed_at = NOW()
         WHERE transaction_id = $3`,
        [JSON.stringify(steps), finalTxSignature, transactionId]
      );

      return {
        transactionId,
        steps,
        status: 'completed',
      };
    } catch (error: any) {
      // Update transaction with error
      await pool.query(
        `UPDATE swap_transactions 
         SET status = 'failed', 
             error_message = $1
         WHERE transaction_id = $2`,
        [error.message, transactionId]
      );

      throw error;
    }
  }

  /**
   * Calculate how to split an amount for better privacy (supports 6-8 note mixing)
   */
  private calculateSplits(amount: number, targetNotes?: number): number[] {
    // Use target notes if provided, otherwise calculate intelligently
    const numSplits = targetNotes || Math.min(
      Math.max(MIN_MIXING_NOTES, Math.floor(amount / this.MIN_SPLIT_AMOUNT)),
      this.MAX_SPLITS
    );
    
    const splits: number[] = [];
    let remaining = amount;

    // Create splits with randomization for better privacy
    // Use varied split sizes to break patterns (unique approach)
    for (let i = 0; i < numSplits - 1; i++) {
      // Vary split percentage: 15% to 35% of remaining (more variation)
      const splitPercent = 0.15 + Math.random() * 0.2;
      const split = remaining * splitPercent;
      
      // Ensure minimum split amount
      const finalSplit = Math.max(split, this.MIN_SPLIT_AMOUNT);
      splits.push(parseFloat(finalSplit.toFixed(9)));
      remaining -= finalSplit;
    }

    // Last split gets the remainder (ensures total equals original amount)
    splits.push(parseFloat(remaining.toFixed(9)));
    
    // Shuffle splits to break order patterns (unique to our approach)
    for (let i = splits.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [splits[i], splits[j]] = [splits[j], splits[i]];
    }
    
    return splits;
  }

  /**
   * Obfuscate amount by adding/subtracting small random value
   */
  private obfuscateAmount(amount: number): number {
    const obfuscation = (Math.random() - 0.5) * 2 * this.OBFUSCATION_RANGE;
    const obfuscated = amount + obfuscation;
    
    // Ensure we don't go negative
    return Math.max(0.0001, parseFloat(obfuscated.toFixed(9)));
  }

  /**
   * Get or create a mixing window
   * Mixing windows group transactions together for better privacy
   */
  private async getOrCreateMixingWindow(): Promise<MixingWindow> {
    const now = new Date();
    const windowStart = new Date(Math.floor(now.getTime() / this.MIXING_WINDOW_DURATION) * this.MIXING_WINDOW_DURATION);
    const windowEnd = new Date(windowStart.getTime() + this.MIXING_WINDOW_DURATION);
    const windowId = `window_${windowStart.getTime()}`;

    // Check if window exists
    const existing = await pool.query(
      `SELECT * FROM mixing_windows WHERE window_id = $1`,
      [windowId]
    );

    if (existing.rows.length > 0) {
      return {
        windowId,
        startTime: new Date(existing.rows[0].start_time),
        endTime: new Date(existing.rows[0].end_time),
        totalAmount: parseFloat(existing.rows[0].total_amount),
        transactionCount: parseInt(existing.rows[0].transaction_count),
      };
    }

    // Create new window
    await pool.query(
      `INSERT INTO mixing_windows (window_id, start_time, end_time, total_amount, transaction_count)
       VALUES ($1, $2, $3, 0, 0)
       ON CONFLICT (window_id) DO NOTHING`,
      [windowId, windowStart, windowEnd]
    );

    return {
      windowId,
      startTime: windowStart,
      endTime: windowEnd,
      totalAmount: 0,
      transactionCount: 0,
    };
  }

  /**
   * Record a deposit in the mixing window
   */
  private async recordMixingDeposit(windowId: string, wallet: string, amount: number): Promise<void> {
    await pool.query(
      `UPDATE mixing_windows 
       SET total_amount = total_amount + $1, 
           transaction_count = transaction_count + 1
       WHERE window_id = $2`,
      [amount, windowId]
    );
  }

  /**
   * Record a withdrawal from the mixing window
   */
  private async recordMixingWithdrawal(windowId: string, wallet: string, amount: number): Promise<void> {
    // Withdrawals are tracked but don't affect the mixing pool balance
    // (since funds are already in intermediate wallets)
    await pool.query(
      `UPDATE mixing_windows 
       SET transaction_count = transaction_count + 1
       WHERE window_id = $1`,
      [windowId]
    );
  }

  /**
   * Calculate mixing delay based on window activity
   * More active windows = longer delay for better mixing
   */
  private calculateMixingDelay(window: MixingWindow): number {
    const baseDelay = 10000; // 10 seconds base
    const activityBonus = Math.min(window.transactionCount * 2000, 30000); // Up to 30s bonus
    const randomVariation = Math.random() * 10000; // 0-10s random
    
    return baseDelay + activityBonus + randomVariation;
  }

  /**
   * Create a new swap transaction record
   */
  async createSwapTransaction(
    sourceWallet: string,
    destinationWallet: string,
    amount: number,
    intermediateWalletId: string,
    sourceTxSignature: string,
    relayerFee?: number
  ): Promise<string> {
    const result = await pool.query(
      `INSERT INTO swap_transactions 
       (source_wallet, destination_wallet, amount_sol, intermediate_wallet_id, source_tx_signature, status, relayer_fee)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6)
       RETURNING transaction_id`,
      [sourceWallet, destinationWallet, amount, intermediateWalletId, sourceTxSignature, relayerFee || 0]
    );

    return result.rows[0].transaction_id;
  }

  /**
   * Get swap transaction status
   */
  async getSwapStatus(transactionId: string): Promise<any> {
    const result = await pool.query(
      `SELECT 
        transaction_id,
        source_wallet,
        destination_wallet,
        amount_sol,
        status,
        steps,
        source_tx_signature,
        final_tx_signature,
        created_at,
        completed_at,
        error_message
       FROM swap_transactions
       WHERE transaction_id = $1`,
      [transactionId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  /**
   * Update transaction status
   */
  private async updateTransactionStatus(transactionId: string, status: string): Promise<void> {
    await pool.query(
      'UPDATE swap_transactions SET status = $1 WHERE transaction_id = $2',
      [status, transactionId]
    );
  }

  /**
   * Add random delay to break timing patterns
   */
  private async addPrivacyDelay(minMs: number = 2000, maxMs: number = 7000): Promise<void> {
    const delay = Math.random() * (maxMs - minMs) + minMs;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

