import { Keypair, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { connection } from '../config/solana';
import { storeKeypair, getKeypair, markWalletAsUsed } from '../utils/keyManager';
import { pool } from '../config/database';
import { TRANSACTION_FEE_RESERVE, TREASURY_WALLET_PRIVATE_KEY } from '../config/constants';
import bs58 from 'bs58';

export interface IntermediateWallet {
  walletId: string;
  publicKey: string;
}

export class WalletService {
  private treasuryKeypair: Keypair | null = null;

  constructor() {
    // Initialize treasury wallet if private key is provided
    if (TREASURY_WALLET_PRIVATE_KEY) {
      try {
        const decoded = bs58.decode(TREASURY_WALLET_PRIVATE_KEY);
        
        // Handle both formats:
        // - 32 bytes: Just the secret key (use fromSecretKey)
        // - 64 bytes: Full keypair (first 32 = secret, last 32 = public, use Keypair constructor)
        if (decoded.length === 64) {
          // Full keypair format - first 32 bytes are secret key, last 32 bytes are public key
          const secretKey = new Uint8Array(decoded.slice(0, 32));
          const publicKey = new Uint8Array(decoded.slice(32, 64));
          this.treasuryKeypair = new Keypair({ publicKey, secretKey });
        } else if (decoded.length === 32) {
          // Just the secret key format
          const secretKey = new Uint8Array(decoded);
          this.treasuryKeypair = Keypair.fromSecretKey(secretKey);
        } else {
          throw new Error(`Invalid key length: ${decoded.length} bytes. Expected 32 (secret key) or 64 (full keypair)`);
        }
        
        console.log(`💰 Treasury wallet loaded: ${this.treasuryKeypair.publicKey.toString()}`);
      } catch (error: any) {
        console.warn(`⚠️ Failed to load treasury wallet: ${error.message}. Intermediate wallets will need to be funded manually or from previous wallets.`);
      }
    }
  }

  /**
   * Get the minimum funding amount for a new wallet (rent exemption + transaction fees)
   */
  private async getMinimumFundingAmount(): Promise<number> {
    try {
      // Calculate rent exemption for a basic account
      const rentExemptBalance = await connection.getMinimumBalanceForRentExemption(0);
      // Add transaction fee reserve on top
      const totalNeeded = rentExemptBalance + Math.floor(TRANSACTION_FEE_RESERVE * LAMPORTS_PER_SOL);
      return totalNeeded / LAMPORTS_PER_SOL; // Convert to SOL
    } catch (error) {
      // Fallback to a safe default if calculation fails
      return 0.001; // 0.001 SOL should cover rent + fees
    }
  }

  /**
   * Fund an intermediate wallet with transaction fee reserve from treasury
   */
  private async fundIntermediateWalletFromTreasury(publicKey: PublicKey): Promise<string | null> {
    if (!this.treasuryKeypair) {
      return null; // No treasury wallet configured
    }

    try {
      // Get minimum funding amount (rent exemption + transaction fees)
      const minimumFunding = await this.getMinimumFundingAmount();
      
      // Check if wallet already has enough balance
      const balance = await this.getBalance(publicKey.toString());
      if (balance >= minimumFunding) {
        return null; // Already funded
      }

      // Check treasury balance (need funding amount + transaction fee)
      const treasuryBalance = await this.getBalance(this.treasuryKeypair.publicKey.toString());
      const requiredFromTreasury = minimumFunding + 0.00001; // Extra for transaction fee
      if (treasuryBalance < requiredFromTreasury) {
        console.warn(`⚠️ Treasury wallet has insufficient balance: ${treasuryBalance} SOL (need ${requiredFromTreasury} SOL)`);
        return null;
      }

      // Fund the intermediate wallet with enough for rent exemption + transaction fees
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: this.treasuryKeypair.publicKey,
          toPubkey: publicKey,
          lamports: Math.floor(minimumFunding * LAMPORTS_PER_SOL),
        })
      );

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = this.treasuryKeypair.publicKey;

      transaction.sign(this.treasuryKeypair);
      const signature = await connection.sendRawTransaction(
        transaction.serialize(),
        { skipPreflight: false }
      );

      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');

      console.log(`✅ Funded intermediate wallet ${publicKey.toString().slice(0, 8)}... with ${minimumFunding.toFixed(6)} SOL from treasury`);
      return signature;
    } catch (error: any) {
      console.error(`❌ Failed to fund intermediate wallet from treasury:`, error.message);
      return null;
    }
  }

  /**
   * Fund an intermediate wallet from another intermediate wallet
   */
  async fundIntermediateWalletFromSource(
    sourceWalletId: string,
    destinationPublicKey: PublicKey
  ): Promise<string | null> {
    try {
      const sourceKeypair = await this.getIntermediateWalletKeypair(sourceWalletId);
      const sourceBalance = await this.getBalance(sourceKeypair.publicKey.toString());

      // Get minimum funding amount (rent exemption + transaction fees)
      const minimumFunding = await this.getMinimumFundingAmount();
      
      // Check if source has enough (minimum funding + fee reserve for itself + transaction fee)
      const requiredFromSource = minimumFunding + TRANSACTION_FEE_RESERVE + 0.00001;
      if (sourceBalance < requiredFromSource) {
        // Try treasury as fallback
        console.log(`⚠️ Source wallet has insufficient balance (${sourceBalance} SOL), trying treasury...`);
        return await this.fundIntermediateWalletFromTreasury(destinationPublicKey);
      }

      // Fund destination from source with enough for rent exemption + transaction fees
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: sourceKeypair.publicKey,
          toPubkey: destinationPublicKey,
          lamports: Math.floor(minimumFunding * LAMPORTS_PER_SOL),
        })
      );

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = sourceKeypair.publicKey;

      transaction.sign(sourceKeypair);
      const signature = await connection.sendRawTransaction(
        transaction.serialize(),
        { skipPreflight: false }
      );

      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');

      console.log(`✅ Funded intermediate wallet ${destinationPublicKey.toString().slice(0, 8)}... with ${minimumFunding.toFixed(6)} SOL from source`);
      return signature;
    } catch (error: any) {
      console.error(`❌ Failed to fund intermediate wallet from source:`, error.message);
      // Try treasury as fallback
      return await this.fundIntermediateWalletFromTreasury(destinationPublicKey);
    }
  }

  /**
   * Generate a new intermediate wallet for privacy
   * Optionally funds it from treasury if configured
   */
  async generateIntermediateWallet(fundFromTreasury: boolean = true): Promise<IntermediateWallet> {
    // Generate new keypair
    const keypair = Keypair.generate();
    
    // Encrypt and store private key securely
    const walletId = await storeKeypair(keypair);
    
    // Fund from treasury if requested and available
    if (fundFromTreasury) {
      await this.fundIntermediateWalletFromTreasury(keypair.publicKey);
    }
    
    return {
      walletId,
      publicKey: keypair.publicKey.toString(),
    };
  }

  /**
   * Get keypair for intermediate wallet (decrypted)
   */
  async getIntermediateWalletKeypair(walletId: string): Promise<Keypair> {
    return await getKeypair(walletId);
  }

  /**
   * Check balance of a wallet
   */
  async getBalance(publicKey: string): Promise<number> {
    const pubkey = new PublicKey(publicKey);
    const balance = await connection.getBalance(pubkey);
    return balance / LAMPORTS_PER_SOL; // Convert lamports to SOL
  }

  /**
   * Transfer from intermediate wallet to destination
   * Automatically reserves transaction fees and rent exemption from the amount
   */
  async transferFromIntermediate(
    walletId: string,
    destination: string,
    amount: number
  ): Promise<string> {
    const keypair = await this.getIntermediateWalletKeypair(walletId);
    const destPubkey = new PublicKey(destination);
    
    // Get current balance
    const balance = await this.getBalance(keypair.publicKey.toString());
    
    // Get minimum rent exemption for a basic account
    const rentExemption = await connection.getMinimumBalanceForRentExemption(0);
    const rentExemptionSOL = rentExemption / LAMPORTS_PER_SOL;
    
    // Calculate available amount (reserve fees + rent exemption)
    // We need to keep rent exemption in the source wallet if it's an intermediate wallet
    // But for final transfers, we can send everything except fees
    const minimumReserve = TRANSACTION_FEE_RESERVE + rentExemptionSOL;
    const availableAmount = Math.max(0, balance - minimumReserve);
    
    // Use the minimum of requested amount and available amount
    const transferAmount = Math.min(amount, availableAmount);
    
    if (transferAmount <= 0) {
      throw new Error(`Insufficient balance for transfer. Balance: ${balance} SOL, Required: ${amount} SOL (with ${minimumReserve} SOL reserve for fees and rent)`);
    }
    
    // Check if destination account exists and has enough for rent
    let destAccountInfo;
    try {
      destAccountInfo = await connection.getAccountInfo(destPubkey);
    } catch (error) {
      // If we can't check, assume it exists (it's a user wallet)
      destAccountInfo = null;
    }
    
    // If destination account doesn't exist, ensure transfer amount covers rent exemption
    if (!destAccountInfo && transferAmount < rentExemptionSOL) {
      throw new Error(`Transfer amount (${transferAmount} SOL) is less than rent exemption requirement (${rentExemptionSOL} SOL). Destination account needs to be created.`);
    }
    
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey: destPubkey,
        lamports: Math.floor(transferAmount * LAMPORTS_PER_SOL),
      })
    );

    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = keypair.publicKey;

    // Sign and send
    transaction.sign(keypair);
    const signature = await connection.sendRawTransaction(
      transaction.serialize(),
      { skipPreflight: false }
    );

    // Confirm transaction
    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    }, 'confirmed');
    
    return signature;
  }

  /**
   * Transfer from intermediate wallet to multiple destinations (e.g., destination + relayer fee)
   * Automatically reserves transaction fees and rent exemption from the total amount
   */
  async transferFromIntermediateMultiple(
    walletId: string,
    transfers: Array<{ destination: string; amount: number }>
  ): Promise<string> {
    const keypair = await this.getIntermediateWalletKeypair(walletId);
    
    // Get current balance
    const balance = await this.getBalance(keypair.publicKey.toString());
    
    // Get minimum rent exemption for a basic account
    const rentExemption = await connection.getMinimumBalanceForRentExemption(0);
    const rentExemptionSOL = rentExemption / LAMPORTS_PER_SOL;
    
    // Calculate available amount (reserve fees + rent exemption)
    const minimumReserve = TRANSACTION_FEE_RESERVE + rentExemptionSOL;
    const availableAmount = Math.max(0, balance - minimumReserve);
    
    // Calculate total requested amount
    const totalRequested = transfers.reduce((sum, t) => sum + t.amount, 0);
    
    if (availableAmount < totalRequested) {
      // Scale down transfers proportionally if needed
      const scaleFactor = availableAmount / totalRequested;
      console.log(`⚠️ Insufficient balance. Scaling transfers by ${(scaleFactor * 100).toFixed(2)}%`);
      
      transfers = transfers.map(t => ({
        ...t,
        amount: t.amount * scaleFactor
      }));
    }
    
    // Check destination accounts exist and have enough for rent if they're new
    for (const transfer of transfers) {
      const destPubkey = new PublicKey(transfer.destination);
      let destAccountInfo;
      try {
        destAccountInfo = await connection.getAccountInfo(destPubkey);
      } catch (error) {
        // If we can't check, assume it exists (it's a user wallet)
        destAccountInfo = null;
      }
      
      // If destination account doesn't exist, ensure transfer amount covers rent exemption
      if (!destAccountInfo && transfer.amount < rentExemptionSOL) {
        console.warn(`⚠️ Transfer amount (${transfer.amount} SOL) to ${transfer.destination} is less than rent exemption (${rentExemptionSOL} SOL). Account may need to exist first.`);
        // For existing user wallets, this shouldn't be an issue, but log it
      }
    }
    
    const transaction = new Transaction();

    // Add all transfers to the transaction
    for (const transfer of transfers) {
      const destPubkey = new PublicKey(transfer.destination);
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: keypair.publicKey,
          toPubkey: destPubkey,
          lamports: Math.floor(transfer.amount * LAMPORTS_PER_SOL),
        })
      );
    }

    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = keypair.publicKey;

    // Sign and send
    transaction.sign(keypair);
    const signature = await connection.sendRawTransaction(
      transaction.serialize(),
      { skipPreflight: false }
    );

    // Confirm transaction
    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    }, 'confirmed');
    
    return signature;
  }

  /**
   * Find intermediate wallet by public key
   */
  async findIntermediateWallet(publicKey: string): Promise<string | null> {
    const result = await pool.query(
      'SELECT wallet_id FROM intermediate_wallets WHERE public_key = $1',
      [publicKey]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0].wallet_id;
  }

  /**
   * Update wallet balance in database
   */
  async updateWalletBalance(walletId: string, balance: number): Promise<void> {
    await pool.query(
      'UPDATE intermediate_wallets SET balance_sol = $1 WHERE wallet_id = $2',
      [balance, walletId]
    );
  }
}

