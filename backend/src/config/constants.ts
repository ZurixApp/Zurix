/**
 * Application constants - IMMUTABLE CONFIGURATION
 * These values are hardcoded and cannot be changed without code deployment.
 * This ensures trustlessness - what you audit is what runs forever.
 */

// ============================================================================
// FEE STRUCTURE (IMMUTABLE)
// ============================================================================
// Relayer fee percentage - IMMUTABLE: 0.05% (0.0005)
// This is hardcoded and cannot be changed. Lower than competitors (0.15%).
export const RELAYER_FEE_PERCENTAGE = 0.0005; // 0.05% - immutable

// Deposit fee - IMMUTABLE: 0% (free deposits)
export const DEPOSIT_FEE_PERCENTAGE = 0; // 0% - immutable

// Relayer fee wallet address (set via environment variable)
// This wallet receives the relayer fees - can be changed for operational reasons
// but fee percentage itself is immutable
export const RELAYER_FEE_WALLET = process.env.RELAYER_FEE_WALLET || '';

// ============================================================================
// TRANSACTION LIMITS (IMMUTABLE)
// ============================================================================
// Minimum swap amount in SOL - IMMUTABLE
export const MIN_SWAP_AMOUNT = 0.03; // 0.03 SOL minimum - immutable

// Maximum swap amount in SOL - IMMUTABLE: No limit (null = unlimited)
export const MAX_SWAP_AMOUNT: number | null = null; // No maximum - immutable

// ============================================================================
// MIXING CAPACITY (IMMUTABLE)
// ============================================================================
// Maximum number of notes (splits) per transaction - IMMUTABLE
// Supports 6-8 note mixing (competitive with 6-note systems, flexible up to 8)
export const MAX_MIXING_NOTES = 8; // Maximum 8 notes per transaction - immutable
export const DEFAULT_MIXING_NOTES = 6; // Default 6 notes - immutable
export const MIN_MIXING_NOTES = 2; // Minimum 2 notes - immutable

// ============================================================================
// PRIVACY PARAMETERS (IMMUTABLE)
// ============================================================================
// Mixing window duration - IMMUTABLE: 60 seconds
export const MIXING_WINDOW_DURATION_MS = 60000; // 1 minute - immutable

// Minimum split amount - IMMUTABLE
export const MIN_SPLIT_AMOUNT = 0.01; // 0.01 SOL per split - immutable

// Amount obfuscation range - IMMUTABLE
export const OBFUSCATION_RANGE = 0.001; // ±0.001 SOL - immutable

// ============================================================================
// EMERGENCY RECOVERY (IMMUTABLE)
// ============================================================================
// Number of deposits required before emergency recovery is available
// After this many deposits by other users, you can recover without relayer
export const EMERGENCY_RECOVERY_THRESHOLD = 50; // 50 deposits - immutable (lower than competitors)

// Time-based recovery fallback (in blocks, ~400ms per block on Solana)
// If relayer inactive for this duration, recovery is automatically enabled
export const RECOVERY_FALLBACK_BLOCKS = 150; // ~60 seconds - immutable

// ============================================================================
// TECHNICAL CONSTANTS
// ============================================================================
// Transaction fee reserve - amount to keep in intermediate wallets for transaction fees
export const TRANSACTION_FEE_RESERVE = 0.0001; // 0.0001 SOL = 100,000 lamports

// Treasury wallet private key (base58 encoded) - used to fund intermediate wallets
// This wallet should have SOL to cover transaction fees for intermediate wallets
export const TREASURY_WALLET_PRIVATE_KEY = process.env.TREASURY_WALLET_PRIVATE_KEY || '';

// ============================================================================
// VERIFICATION
// ============================================================================
/**
 * Get immutable configuration hash for verification
 * This allows users to verify the configuration hasn't changed
 */
export function getConfigHash(): string {
  const config = {
    relayerFee: RELAYER_FEE_PERCENTAGE,
    depositFee: DEPOSIT_FEE_PERCENTAGE,
    minSwap: MIN_SWAP_AMOUNT,
    maxSwap: MAX_SWAP_AMOUNT,
    maxNotes: MAX_MIXING_NOTES,
    defaultNotes: DEFAULT_MIXING_NOTES,
    mixingWindow: MIXING_WINDOW_DURATION_MS,
    minSplit: MIN_SPLIT_AMOUNT,
    obfuscation: OBFUSCATION_RANGE,
    recoveryThreshold: EMERGENCY_RECOVERY_THRESHOLD,
    recoveryFallback: RECOVERY_FALLBACK_BLOCKS,
  };
  return require('crypto').createHash('sha256').update(JSON.stringify(config)).digest('hex');
}

