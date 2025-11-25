import { Keypair } from '@solana/web3.js';
import { pool } from '../config/database';
import { encrypt, decrypt } from './encryption';

/**
 * Store encrypted keypair in database
 */
export async function storeKeypair(keypair: Keypair): Promise<string> {
  const privateKeyArray = Array.from(keypair.secretKey);
  
  // Encrypt private key
  const encryptedKey = encrypt(JSON.stringify(privateKeyArray));
  
  // Store in database
  const result = await pool.query(
    `INSERT INTO intermediate_wallets (public_key, encrypted_private_key, created_at) 
     VALUES ($1, $2, NOW()) 
     RETURNING wallet_id`,
    [keypair.publicKey.toString(), encryptedKey]
  );
  
  return result.rows[0].wallet_id;
}

/**
 * Retrieve and decrypt keypair
 */
export async function getKeypair(walletId: string): Promise<Keypair> {
  const result = await pool.query(
    'SELECT encrypted_private_key FROM intermediate_wallets WHERE wallet_id = $1',
    [walletId]
  );
  
  if (result.rows.length === 0) {
    throw new Error(`Wallet ${walletId} not found`);
  }
  
  const decryptedKey = decrypt(result.rows[0].encrypted_private_key);
  const keyArray = JSON.parse(decryptedKey);
  
  return Keypair.fromSecretKey(Uint8Array.from(keyArray));
}

/**
 * Get keypair by public key
 */
export async function getKeypairByPublicKey(publicKey: string): Promise<Keypair | null> {
  const result = await pool.query(
    'SELECT encrypted_private_key FROM intermediate_wallets WHERE public_key = $1',
    [publicKey]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const decryptedKey = decrypt(result.rows[0].encrypted_private_key);
  const keyArray = JSON.parse(decryptedKey);
  
  return Keypair.fromSecretKey(Uint8Array.from(keyArray));
}

/**
 * Mark wallet as used
 */
export async function markWalletAsUsed(walletId: string): Promise<void> {
  await pool.query(
    'UPDATE intermediate_wallets SET used_at = NOW(), is_active = false WHERE wallet_id = $1',
    [walletId]
  );
}

