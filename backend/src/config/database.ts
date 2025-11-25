import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Railway and most cloud providers require SSL
  ssl: process.env.DATABASE_URL?.includes('railway') || 
       process.env.DATABASE_URL?.includes('supabase') ||
       process.env.DATABASE_URL?.includes('neon') ||
       process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false } 
    : false,
});

// Test database connection
pool.on('connect', () => {
  console.log('📊 Database connected');
});

pool.on('error', (err) => {
  console.error('❌ Database connection error:', err);
});

// Initialize database tables
export async function initializeDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS intermediate_wallets (
        wallet_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        public_key VARCHAR(44) UNIQUE NOT NULL,
        encrypted_private_key TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        used_at TIMESTAMP,
        is_active BOOLEAN DEFAULT true,
        balance_sol DECIMAL(20, 9) DEFAULT 0
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS swap_transactions (
        transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_wallet VARCHAR(44) NOT NULL,
        destination_wallet VARCHAR(44) NOT NULL,
        amount_sol DECIMAL(20, 9) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        intermediate_wallet_id UUID REFERENCES intermediate_wallets(wallet_id),
        steps JSONB DEFAULT '[]'::jsonb,
        source_tx_signature VARCHAR(88),
        final_tx_signature VARCHAR(88),
        relayer_fee DECIMAL(20, 9) DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP,
        error_message TEXT
      )
    `);

    // Add relayer_fee column if it doesn't exist (for existing databases)
    await pool.query(`
      ALTER TABLE swap_transactions 
      ADD COLUMN IF NOT EXISTS relayer_fee DECIMAL(20, 9) DEFAULT 0
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_swap_source ON swap_transactions(source_wallet)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_swap_destination ON swap_transactions(destination_wallet)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_swap_status ON swap_transactions(status)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_wallets_active ON intermediate_wallets(is_active)
    `);

    // Mixing windows table for enhanced privacy (inspired by Elusiv)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mixing_windows (
        window_id VARCHAR(100) PRIMARY KEY,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        total_amount DECIMAL(20, 9) DEFAULT 0,
        transaction_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_mixing_windows_time ON mixing_windows(start_time, end_time)
    `);

    // Encrypted transaction memos table (end-to-end encrypted)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS encrypted_memos (
        memo_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        transaction_id UUID REFERENCES swap_transactions(transaction_id),
        encrypted_data TEXT NOT NULL,
        encryption_metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_memos_transaction ON encrypted_memos(transaction_id)
    `);

    // Emergency recovery tracking
    await pool.query(`
      CREATE TABLE IF NOT EXISTS recovery_tracking (
        transaction_id UUID PRIMARY KEY REFERENCES swap_transactions(transaction_id),
        deposit_count_at_creation INTEGER DEFAULT 0,
        last_checked_at TIMESTAMP DEFAULT NOW(),
        recovery_available BOOLEAN DEFAULT false,
        recovery_key_hash VARCHAR(64),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_recovery_available ON recovery_tracking(recovery_available, deposit_count_at_creation)
    `);

    // Deposit counter for emergency recovery (tracks total deposits in system)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS deposit_counter (
        counter_id VARCHAR(50) PRIMARY KEY DEFAULT 'main',
        total_deposits INTEGER DEFAULT 0,
        last_updated TIMESTAMP DEFAULT NOW()
      )
    `);

    // Initialize deposit counter if it doesn't exist
    await pool.query(`
      INSERT INTO deposit_counter (counter_id, total_deposits)
      VALUES ('main', 0)
      ON CONFLICT (counter_id) DO NOTHING
    `);

    console.log('✅ Database tables initialized');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  }
}

