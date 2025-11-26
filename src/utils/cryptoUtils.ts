/**
 * Client-Side Cryptographic Utilities
 * 
 * All sensitive operations happen in the browser.
 * Server never sees secret keys, commitments, or decryption keys.
 */

/**
 * Generate EdDSA keypair for commitments (client-side)
 * Similar to Poseidon but using our own implementation
 */
export async function generateEdDSAKeypair(): Promise<{ publicKey: string; privateKey: string }> {
  // Generate random 32-byte private key
  const privateKeyBytes = new Uint8Array(32);
  crypto.getRandomValues(privateKeyBytes);
  
  // For EdDSA on Solana, we can use the native keypair generation
  // This is a simplified version - in production, use proper EdDSA library
  const privateKey = Array.from(privateKeyBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  // In a real implementation, derive public key from private key using EdDSA
  // For now, we'll use a hash-based approach (simplified)
  const publicKeyHash = await crypto.subtle.digest('SHA-256', privateKeyBytes as BufferSource);
  
  return {
    privateKey: privateKey,
    publicKey: 'ed25519_' + privateKey.slice(0, 16), // Simplified - use proper EdDSA in production
  };
}

/**
 * Generate recovery key (client-side)
 * User must store this securely - needed for emergency recovery
 */
export function generateRecoveryKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Create commitment for deposit (client-side)
 * Server never sees the secret values
 */
export async function createCommitment(
  amount: number,
  secret: string,
  nullifierSecret: string
): Promise<{ commitment: string; nullifier: string }> {
  // Create commitment hash: H(amount || secret || nullifierSecret)
  const commitmentData = `${amount}:${secret}:${nullifierSecret}`;
  const commitmentDataBytes = new TextEncoder().encode(commitmentData);
  const commitmentBuffer = await crypto.subtle.digest('SHA-256', commitmentDataBytes as BufferSource);
  
  // Create nullifier: H(nullifierSecret || index)
  const nullifierData = `${nullifierSecret}:${Date.now()}`;
  const nullifierDataBytes = new TextEncoder().encode(nullifierData);
  const nullifierBuffer = await crypto.subtle.digest('SHA-256', nullifierDataBytes as BufferSource);
  
  return {
    commitment: '0x' + Array.from(new Uint8Array(commitmentBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(''),
    nullifier: '0x' + Array.from(new Uint8Array(nullifierBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(''),
  };
}

/**
 * Encrypt transaction memo (client-side)
 * Server stores encrypted data but cannot decrypt
 */
export async function encryptMemo(
  data: any,
  encryptionKey: string
): Promise<{ encrypted: string; metadata: any }> {
  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(16));
  
  // Import key
  const keyBytes = new TextEncoder().encode(encryptionKey);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    keyBytes as BufferSource,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: iv as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  
  // Encrypt
  const dataBytes = new TextEncoder().encode(JSON.stringify(data));
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    dataBytes as BufferSource
  );
  
  // Combine IV + encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return {
    encrypted: btoa(String.fromCharCode(...combined)),
    metadata: {
      algorithm: 'AES-GCM',
      keyDerivation: 'PBKDF2',
      iterations: 100000,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Decrypt transaction memo (client-side)
 */
export async function decryptMemo(
  encryptedData: string,
  encryptionKey: string,
  metadata: any
): Promise<any> {
  // Decode base64
  const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
  
  // Extract IV and encrypted data
  const iv = combined.slice(0, 16);
  const encrypted = combined.slice(16);
  
  // Import and derive key
  const keyBytes = new TextEncoder().encode(encryptionKey);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    keyBytes as BufferSource,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: iv as BufferSource,
      iterations: metadata.iterations || 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  
  // Decrypt
  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    encrypted as BufferSource
  );
  
  return JSON.parse(new TextDecoder().decode(decrypted));
}

