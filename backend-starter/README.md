# Privacy Swap Backend

Backend service for private Solana swaps.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy environment variables:
```bash
cp .env.example .env
```

3. Update `.env` with your configuration:
   - Solana RPC URL (use devnet for testing)
   - Database connection
   - Encryption key

4. Run development server:
```bash
npm run dev
```

## API Endpoints

### POST /api/swap/initiate
Initiate a private swap.

**Request Body:**
```json
{
  "sourceWallet": "source_wallet_address",
  "destinationWallet": "destination_wallet_address",
  "amount": 1.5,
  "sourceTxSignature": "transaction_signature_from_user"
}
```

**Response:**
```json
{
  "success": true,
  "transactionId": "uuid",
  "steps": [...]
}
```

### GET /api/swap/status/:transactionId
Get swap status.

## Next Steps

1. Implement wallet service for intermediate wallet management
2. Add database models and migrations
3. Implement privacy routing logic
4. Add transaction monitoring
5. Set up secure key management

See `BACKEND_GUIDE.md` in the root directory for detailed implementation guide.

