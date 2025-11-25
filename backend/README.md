# Privacy Swap Backend

Complete backend service for private Solana swaps with intermediate wallet routing.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and configure:

- **SOLANA_RPC_URL**: Your Solana RPC endpoint (use devnet for testing)
- **DATABASE_URL**: PostgreSQL connection string
- **ENCRYPTION_KEY**: Generate a random 32-byte hex key (see below)

### 3. Generate Encryption Key

Generate a secure encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output and paste it as `ENCRYPTION_KEY` in your `.env` file.

### 4. Set Up Database

Make sure PostgreSQL is running and create a database:

```sql
CREATE DATABASE privacy_swap;
```

The tables will be created automatically on first run.

### 5. Run the Server

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm run build
npm start
```

## 📋 API Endpoints

### POST /api/swap/prepare

Prepare a swap by generating an intermediate wallet.

**Request:**
```json
{
  "sourceWallet": "source_wallet_address",
  "destinationWallet": "destination_wallet_address",
  "amount": 1.5
}
```

**Response:**
```json
{
  "success": true,
  "intermediateWallet": {
    "publicKey": "intermediate_wallet_address",
    "walletId": "uuid"
  },
  "instructions": {
    "step1": "Send 1.5 SOL from source to intermediate",
    "step2": "Call /api/swap/initiate with transaction signature"
  }
}
```

### POST /api/swap/initiate

Initiate the private swap after funds are sent to intermediate wallet.

**Request:**
```json
{
  "sourceWallet": "source_wallet_address",
  "destinationWallet": "destination_wallet_address",
  "amount": 1.5,
  "sourceTxSignature": "transaction_signature",
  "intermediateWalletId": "uuid_from_prepare"
}
```

**Response:**
```json
{
  "success": true,
  "transactionId": "uuid",
  "message": "Swap initiated. The transaction will be processed automatically.",
  "status": "pending"
}
```

### GET /api/swap/status/:transactionId

Get the status of a swap transaction.

**Response:**
```json
{
  "success": true,
  "transaction": {
    "transaction_id": "uuid",
    "source_wallet": "address",
    "destination_wallet": "address",
    "amount_sol": "1.5",
    "status": "completed",
    "steps": [...],
    "source_tx_signature": "...",
    "final_tx_signature": "...",
    "created_at": "...",
    "completed_at": "..."
  }
}
```

### GET /api/swap/intermediate/:walletId

Get intermediate wallet details and balance.

## 🔄 How It Works

1. **User calls `/prepare`** → Backend generates intermediate wallet
2. **User sends SOL** → From source wallet to intermediate wallet
3. **User calls `/initiate`** → Backend records the transaction
4. **Monitor processes** → Automatically detects funds and completes swap
5. **Final transfer** → Intermediate wallet → Destination wallet

## 🔍 Transaction Monitor

The backend automatically monitors for pending transactions every 10 seconds. When funds arrive in an intermediate wallet, it:

1. Verifies the transaction
2. Waits for privacy delay (2-7 seconds)
3. Transfers funds to destination
4. Updates transaction status

## 🗄️ Database Schema

### intermediate_wallets
- Stores encrypted private keys for intermediate wallets
- Tracks usage and balances

### swap_transactions
- Records all swap transactions
- Stores transaction steps and signatures
- Tracks status and errors

## 🔒 Security Notes

- **Encryption**: Private keys are encrypted using AES-256-GCM
- **Key Management**: For production, consider AWS KMS or HashiCorp Vault
- **Database**: Use SSL connections in production
- **RPC**: Use reliable RPC providers (Helius, QuickNode)

## 🛠️ Development

### Type Checking
```bash
npm run type-check
```

### Build
```bash
npm run build
```

## 📝 What You Need to Add

See `SETUP_GUIDE.md` for detailed instructions on what you need to configure and add for production use.

