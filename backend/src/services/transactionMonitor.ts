import { Connection, PublicKey } from '@solana/web3.js';
import { connection } from '../config/solana';
import { pool } from '../config/database';
import { PrivacyService } from './privacyService';
import { EnhancedPrivacyService } from './enhancedPrivacyService';
import { WalletService } from './walletService';
import { TRANSACTION_FEE_RESERVE } from '../config/constants';

export class TransactionMonitor {
  private privacyService: PrivacyService | EnhancedPrivacyService;
  private walletService: WalletService;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(privacyService: PrivacyService | EnhancedPrivacyService, walletService: WalletService) {
    this.privacyService = privacyService;
    this.walletService = walletService;
  }

  /**
   * Start monitoring pending transactions
   */
  startMonitoring(intervalMs: number = 10000) {
    console.log('🔍 Starting transaction monitor...');
    
    this.monitoringInterval = setInterval(async () => {
      await this.checkPendingTransactions();
    }, intervalMs);

    // Also check immediately
    this.checkPendingTransactions();
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('🛑 Transaction monitor stopped');
    }
  }

  /**
   * Check for pending transactions and process them
   */
  private async checkPendingTransactions() {
    try {
      // Get all pending transactions
      const result = await pool.query(
        `SELECT 
          st.transaction_id,
          st.source_wallet,
          st.destination_wallet,
          st.amount_sol,
          st.source_tx_signature,
          st.intermediate_wallet_id,
          iw.public_key as intermediate_public_key
         FROM swap_transactions st
         JOIN intermediate_wallets iw ON st.intermediate_wallet_id = iw.wallet_id
         WHERE st.status = 'pending'
         ORDER BY st.created_at ASC
         LIMIT 10`
      );

      for (const tx of result.rows) {
        await this.processPendingTransaction(tx);
      }
    } catch (error) {
      console.error('Error checking pending transactions:', error);
    }
  }

  /**
   * Process a single pending transaction
   */
  private async processPendingTransaction(tx: any) {
    try {
      // Verify source transaction exists and is confirmed
      const sourceTx = await connection.getTransaction(tx.source_tx_signature, {
        commitment: 'confirmed',
      });

      if (!sourceTx) {
        console.log(`⏳ Transaction ${tx.transaction_id}: Source TX not found yet`);
        return;
      }

      // Check if funds are in intermediate wallet
      // Account for transaction fee reserve
      const balance = await this.walletService.getBalance(tx.intermediate_public_key);
      const requiredAmount = parseFloat(tx.amount_sol);
      
      // Need enough for the amount plus fee reserve for subsequent transfers
      if (balance < requiredAmount + TRANSACTION_FEE_RESERVE) {
        console.log(`⏳ Transaction ${tx.transaction_id}: Waiting for funds (balance: ${balance} SOL, need: ${requiredAmount + TRANSACTION_FEE_RESERVE} SOL)`);
        return;
      }

      console.log(`✅ Processing transaction ${tx.transaction_id}`);

      // Execute the private swap
      await this.privacyService.executePrivateSwap(
        tx.source_wallet,
        tx.destination_wallet,
        parseFloat(tx.amount_sol),
        tx.source_tx_signature,
        tx.intermediate_wallet_id
      );

      console.log(`✅ Transaction ${tx.transaction_id} completed`);
    } catch (error: any) {
      console.error(`❌ Error processing transaction ${tx.transaction_id}:`, error.message);
    }
  }
}

