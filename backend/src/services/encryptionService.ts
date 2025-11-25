import * as crypto from 'crypto';
import { pool } from '../config/database';

/**
 * Encryption Service for End-to-End Encrypted Transaction Memos
 * 
 * Unique approach: Server stores encrypted data but is completely blind to contents.
 * Only the client holds decryption keys. Database breach = encrypted noise.
 */
export class EncryptionService {
  /**
   * Encrypt transaction memo data (client-side encryption key required)
   * Returns encrypted data + metadata for storage
   */
  static encryptMemo(data: any, clientEncryptionKey: string): { encrypted: string; metadata: any } {
    // Generate a random IV for this encryption
    const iv = crypto.randomBytes(16);
    const algorithm = 'aes-256-gcm';
    
    // Derive key from client's encryption key
    const key = crypto.createHash('sha256').update(clientEncryptionKey).digest();
    
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    // Encrypt the data
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(data), 'utf8'),
      cipher.final()
    ]);
    
    // Get authentication tag
    const authTag = cipher.getAuthTag();
    
    // Combine IV + encrypted data + auth tag
    const encryptedData = Buffer.concat([iv, authTag, encrypted]).toString('base64');
    
    return {
      encrypted: encryptedData,
      metadata: {
        algorithm: 'aes-256-gcm',
        ivLength: 16,
        authTagLength: 16,
        timestamp: new Date().toISOString(),
      }
    };
  }

  /**
   * Decrypt transaction memo data (requires client encryption key)
   * This should be called client-side, server never sees the key
   */
  static decryptMemo(encryptedData: string, clientEncryptionKey: string): any {
    const buffer = Buffer.from(encryptedData, 'base64');
    
    // Extract IV, auth tag, and encrypted data
    const iv = buffer.slice(0, 16);
    const authTag = buffer.slice(16, 32);
    const encrypted = buffer.slice(32);
    
    const algorithm = 'aes-256-gcm';
    const key = crypto.createHash('sha256').update(clientEncryptionKey).digest();
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);
    
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
    
    return JSON.parse(decrypted.toString('utf8'));
  }

  /**
   * Store encrypted memo in database (server is blind to contents)
   */
  static async storeEncryptedMemo(
    transactionId: string,
    encryptedData: string,
    metadata: any
  ): Promise<string> {
    const result = await pool.query(
      `INSERT INTO encrypted_memos (transaction_id, encrypted_data, encryption_metadata)
       VALUES ($1, $2, $3)
       RETURNING memo_id`,
      [transactionId, encryptedData, JSON.stringify(metadata)]
    );
    
    return result.rows[0].memo_id;
  }

  /**
   * Retrieve encrypted memo (server cannot decrypt)
   */
  static async getEncryptedMemo(transactionId: string): Promise<{ encrypted: string; metadata: any } | null> {
    const result = await pool.query(
      `SELECT encrypted_data, encryption_metadata 
       FROM encrypted_memos 
       WHERE transaction_id = $1`,
      [transactionId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return {
      encrypted: result.rows[0].encrypted_data,
      metadata: result.rows[0].encryption_metadata,
    };
  }
}

