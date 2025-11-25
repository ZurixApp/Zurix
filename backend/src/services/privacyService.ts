import * as crypto from 'crypto';
import { WalletService } from './walletService';
import { pool } from '../config/database';
import { markWalletAsUsed } from '../utils/keyManager';
import { RELAYER_FEE_WALLET, RELAYER_FEE_PERCENTAGE } from '../config/constants';
import { PublicKey } from '@solana/web3.js';

export interface SwapStep {
  step: number;
  from: string;
  to: string;
  txSignature: string;
  timestamp: string;
}

export interface SwapResult {
  transactionId: string;
  steps: SwapStep[];
  status: string;
}

export class PrivacyService {
  private walletService: WalletService;

  constructor(walletService: WalletService) {
    this.walletService = walletService;
  }

  /**
   * Execute a private swap with multi-hop intermediate wallet routing
   * Uses 2-3 intermediate wallets with randomized delays for enhanced privacy
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

      // Record initial transfer
      steps.push({
        step: 1,
        from: sourceWallet,
        to: firstIntermediatePublicKey,
        txSignature: sourceTxSignature,
        timestamp: new Date().toISOString(),
      });

      // Step 2: Generate second intermediate wallet (first hop)
      const secondIntermediate = await this.walletService.generateIntermediateWallet(false); // Don't fund from treasury, we'll fund from source
      
      // Fund the new intermediate wallet from the first one
      await this.walletService.fundIntermediateWalletFromSource(
        intermediateWalletId,
        new PublicKey(secondIntermediate.publicKey)
      );
      
      // Add randomized delay before first hop (3-8 seconds)
      await this.addPrivacyDelay(3000, 8000);

      // Step 3: Transfer from first intermediate to second intermediate
      const hop1Signature = await this.walletService.transferFromIntermediate(
        intermediateWalletId,
        secondIntermediate.publicKey,
        amount
      );

      steps.push({
        step: 2,
        from: firstIntermediatePublicKey,
        to: secondIntermediate.publicKey,
        txSignature: hop1Signature,
        timestamp: new Date().toISOString(),
      });

      // Mark first intermediate wallet as used
      await markWalletAsUsed(intermediateWalletId);

      // Step 4: Generate third intermediate wallet (second hop) - optional but recommended
      // Randomly decide whether to use 2 or 3 hops (70% chance of 3 hops for better privacy)
      const useThirdHop = Math.random() > 0.3;
      let currentWalletId = secondIntermediate.walletId;
      let currentPublicKey = secondIntermediate.publicKey;

      if (useThirdHop) {
        const thirdIntermediate = await this.walletService.generateIntermediateWallet(false);
        
        // Fund the third intermediate wallet from the second one
        await this.walletService.fundIntermediateWalletFromSource(
          secondIntermediate.walletId,
          new PublicKey(thirdIntermediate.publicKey)
        );
        
        // Add randomized delay before second hop (5-12 seconds)
        await this.addPrivacyDelay(5000, 12000);

        // Transfer from second to third intermediate
        const hop2Signature = await this.walletService.transferFromIntermediate(
          secondIntermediate.walletId,
          thirdIntermediate.publicKey,
          amount
        );

        steps.push({
          step: 3,
          from: secondIntermediate.publicKey,
          to: thirdIntermediate.publicKey,
          txSignature: hop2Signature,
          timestamp: new Date().toISOString(),
        });

        // Mark second intermediate as used
        await markWalletAsUsed(secondIntermediate.walletId);
        
        currentWalletId = thirdIntermediate.walletId;
        currentPublicKey = thirdIntermediate.publicKey;
      } else {
        // Mark second intermediate as used even if we don't use third hop
        await markWalletAsUsed(secondIntermediate.walletId);
      }

      // Step 5: Final delay before destination transfer (longer delay for better privacy)
      // Random delay between 8-20 seconds
      await this.addPrivacyDelay(8000, 20000);

      // Step 6: Calculate relayer fee and transfer to destination + relayer
      // Get relayer fee from transaction record, or calculate it
      const transactionRecord = await pool.query(
        'SELECT relayer_fee FROM swap_transactions WHERE transaction_id = $1',
        [transactionId]
      );
      
      let relayerFee = 0;
      if (transactionRecord.rows.length > 0 && transactionRecord.rows[0].relayer_fee) {
        relayerFee = parseFloat(transactionRecord.rows[0].relayer_fee);
      } else {
        // Fallback: calculate fee if not stored
        relayerFee = amount * RELAYER_FEE_PERCENTAGE;
      }
      
      const amountAfterFee = amount - relayerFee;
      
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
        // (fee is still tracked in database for accounting)
        finalTxSignature = await this.walletService.transferFromIntermediate(
          currentWalletId,
          destinationWallet,
          amount
        );
      }

      const finalStepNumber = useThirdHop ? 4 : 3;
      steps.push({
        step: finalStepNumber,
        from: currentPublicKey,
        to: destinationWallet,
        txSignature: finalTxSignature,
        timestamp: new Date().toISOString(),
      });

      // Mark final intermediate wallet as used
      await markWalletAsUsed(currentWalletId);

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
   * @param minMs Minimum delay in milliseconds
   * @param maxMs Maximum delay in milliseconds
   */
  private async addPrivacyDelay(minMs: number = 2000, maxMs: number = 7000): Promise<void> {
    const delay = Math.random() * (maxMs - minMs) + minMs;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

