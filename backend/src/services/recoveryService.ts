import * as crypto from 'crypto';
import { pool } from '../config/database';
import { WalletService } from './walletService';
import { EMERGENCY_RECOVERY_THRESHOLD, RECOVERY_FALLBACK_BLOCKS } from '../config/constants';
import { connection } from '../config/solana';

/**
 * Emergency Recovery Service
 * 
 * Unique approach: After N deposits by other users OR if relayer inactive,
 * users can recover funds directly without relayer intervention.
 * Different from competitors - uses deposit count + time-based fallback.
 */
export class RecoveryService {
  private walletService: WalletService;

  constructor(walletService: WalletService) {
    this.walletService = walletService;
  }

  /**
   * Increment deposit counter (called when new deposit is made)
   */
  async incrementDepositCounter(): Promise<number> {
    const result = await pool.query(
      `UPDATE deposit_counter 
       SET total_deposits = total_deposits + 1, 
           last_updated = NOW()
       WHERE counter_id = 'main'
       RETURNING total_deposits`
    );
    
    return result.rows[0]?.total_deposits || 0;
  }

  /**
   * Get current deposit count
   */
  async getDepositCount(): Promise<number> {
    const result = await pool.query(
      `SELECT total_deposits FROM deposit_counter WHERE counter_id = 'main'`
    );
    
    return result.rows[0]?.total_deposits || 0;
  }

  /**
   * Initialize recovery tracking for a transaction
   */
  async initializeRecovery(
    transactionId: string,
    recoveryKeyHash: string
  ): Promise<void> {
    const depositCount = await this.getDepositCount();
    
    await pool.query(
      `INSERT INTO recovery_tracking 
       (transaction_id, deposit_count_at_creation, recovery_key_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (transaction_id) DO UPDATE
       SET deposit_count_at_creation = EXCLUDED.deposit_count_at_creation`,
      [transactionId, depositCount, recoveryKeyHash]
    );
  }

  /**
   * Check if emergency recovery is available for a transaction
   */
  async checkRecoveryAvailability(transactionId: string): Promise<{
    available: boolean;
    reason: 'threshold' | 'timeout' | 'none';
    details: any;
  }> {
    const recovery = await pool.query(
      `SELECT * FROM recovery_tracking WHERE transaction_id = $1`,
      [transactionId]
    );
    
    if (recovery.rows.length === 0) {
      return { available: false, reason: 'none', details: null };
    }
    
    const recoveryData = recovery.rows[0];
    const currentDepositCount = await this.getDepositCount();
    const depositsSinceCreation = currentDepositCount - recoveryData.deposit_count_at_creation;
    
    // Check threshold-based recovery (after N deposits)
    if (depositsSinceCreation >= EMERGENCY_RECOVERY_THRESHOLD) {
      await pool.query(
        `UPDATE recovery_tracking 
         SET recovery_available = true, last_checked_at = NOW()
         WHERE transaction_id = $1`,
        [transactionId]
      );
      
      return {
        available: true,
        reason: 'threshold',
        details: {
          depositsSinceCreation,
          threshold: EMERGENCY_RECOVERY_THRESHOLD,
        }
      };
    }
    
      // Check time-based recovery (if relayer inactive)
      const transaction = await pool.query(
        `SELECT created_at, status FROM swap_transactions WHERE transaction_id = $1`,
        [transactionId]
      );
      
      if (transaction.rows.length > 0 && transaction.rows[0].status === 'pending') {
        const createdAt = new Date(transaction.rows[0].created_at);
        const now = new Date();
        const ageMs = now.getTime() - createdAt.getTime();
        
        // Use time-based fallback (Solana blocks are ~400ms, so 150 blocks ≈ 60 seconds)
        // We can't easily get historical slot numbers, so we use time-based calculation
        const fallbackSeconds = RECOVERY_FALLBACK_BLOCKS * 0.4; // ~400ms per block on Solana
        const ageSeconds = Math.floor(ageMs / 1000);
        
        if (ageSeconds >= fallbackSeconds) {
          await pool.query(
            `UPDATE recovery_tracking 
             SET recovery_available = true, last_checked_at = NOW()
             WHERE transaction_id = $1`,
            [transactionId]
          );
          
          return {
            available: true,
            reason: 'timeout',
            details: {
              ageSeconds,
              thresholdSeconds: fallbackSeconds,
              estimatedBlocks: Math.floor(ageSeconds / 0.4), // Approximate block count
            }
          };
        }
      }
    
    return {
      available: false,
      reason: 'none',
      details: {
        depositsSinceCreation,
        threshold: EMERGENCY_RECOVERY_THRESHOLD,
      }
    };
  }

  /**
   * Execute emergency recovery (user can withdraw directly)
   */
  async executeRecovery(
    transactionId: string,
    recoveryKey: string,
    destinationWallet: string
  ): Promise<{ success: boolean; txSignature?: string; error?: string }> {
    // Verify recovery is available
    const recoveryCheck = await this.checkRecoveryAvailability(transactionId);
    if (!recoveryCheck.available) {
      return {
        success: false,
        error: `Recovery not available. Reason: ${recoveryCheck.reason}. Details: ${JSON.stringify(recoveryCheck.details)}`
      };
    }
    
    // Verify recovery key
    const recovery = await pool.query(
      `SELECT recovery_key_hash FROM recovery_tracking WHERE transaction_id = $1`,
      [transactionId]
    );
    
    if (recovery.rows.length === 0) {
      return { success: false, error: 'Recovery record not found' };
    }
    
    const recoveryKeyHash = crypto.createHash('sha256').update(recoveryKey).digest('hex');
    if (recovery.rows[0].recovery_key_hash !== recoveryKeyHash) {
      return { success: false, error: 'Invalid recovery key' };
    }
    
    // Get transaction details
    const transaction = await pool.query(
      `SELECT intermediate_wallet_id, amount_sol, relayer_fee 
       FROM swap_transactions 
       WHERE transaction_id = $1`,
      [transactionId]
    );
    
    if (transaction.rows.length === 0) {
      return { success: false, error: 'Transaction not found' };
    }
    
    const txData = transaction.rows[0];
    const intermediateWalletId = txData.intermediate_wallet_id;
    const amount = parseFloat(txData.amount_sol);
    const relayerFee = parseFloat(txData.relayer_fee || 0);
    const amountAfterFee = amount - relayerFee;
    
    // Transfer directly to destination (bypassing mixing for recovery)
    try {
      const txSignature = await this.walletService.transferFromIntermediate(
        intermediateWalletId,
        destinationWallet,
        amountAfterFee
      );
      
      // Update transaction status
      await pool.query(
        `UPDATE swap_transactions 
         SET status = 'recovered', 
             final_tx_signature = $1,
             completed_at = NOW()
         WHERE transaction_id = $2`,
        [txSignature, transactionId]
      );
      
      return { success: true, txSignature };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

