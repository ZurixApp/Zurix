# Zurix - Private Solana Transfers

A privacy-focused Solana transaction protocol enabling private transfers through advanced mixing pools, multi-hop routing, and cryptographic guarantees. The system breaks transaction links between source and destination addresses while maintaining usability.

**Contract Address:** FE8M5QPGMy6ai1sBMGFLkesNBvPURniZ9uoDELEpump

## Overview

Zurix implements a sophisticated privacy protocol inspired by Elusiv's mixing pool architecture:

- **Mixing Pool Architecture**: Decouples deposits and withdrawals to break direct links
- **Time-Based Windows**: Groups transactions into 60s windows to increase anonymity sets
- **Multi-Note Splitting**: Splits funds into 6-8 smaller notes with different paths
- **Amount Obfuscation**: Adds ±0.001 SOL random adjustments to break correlation
- **Multi-Hop Routing**: Funds pass through 2-3 intermediate wallets with randomized delays
- **Temporal Obfuscation**: 10-40s delays break timing correlation

## Key Features

### Privacy Mechanisms

- **Mixing Pools**: Deposit and withdrawal wallets are completely separate, breaking transaction links
- **Time-Based Windows**: Transactions grouped in 60-second mixing windows
- **Multi-Note Protocol**: Amounts split into 6-8 notes (default 6, max 8, min 2)
- **Amount Obfuscation**: Random ±0.001 SOL adjustments prevent amount correlation
- **Multi-Hop Routing**: 2-3 intermediate wallets with 5-20s randomized delays
- **End-to-End Encryption**: AES-256-GCM with PBKDF2 key derivation for transaction memos

### Security Features

- **Immutable Configuration**: Hardcoded fees and limits ensure trustlessness
- **Emergency Recovery**: Time-based fallback and deposit threshold recovery
- **Encrypted Storage**: All private keys encrypted with AES-256-GCM
- **Client-Side Decryption**: Recovery keys never leave the client

### Immutable Configuration

- **Relayer Fee**: 0.05% (hardcoded, cannot be changed)
- **Deposit Fee**: 0% (free deposits)
- **Minimum Amount**: 0.03 SOL
- **Maximum Notes**: 8 per transaction
- **Default Notes**: 6 per transaction
- **Mixing Window**: 60 seconds

## Architecture

The system consists of:

1. **Backend Service Layer**: Express.js API managing transactions
2. **Wallet Management Service**: Generates and manages intermediate wallets
3. **Privacy Coordination Engine**: Handles mixing pools, routing, and delays
4. **PostgreSQL Database**: Stores transactions, wallets, and mixing windows

### Transaction Flow

1. **Preparation**: Client calls API, backend generates encrypted intermediate wallet
2. **Deposit**: User sends SOL, system verifies on-chain and initiates swap
3. **Splitting & Mixing**: Amount split into 6-8 notes, assigned to 60s mixing window
4. **Withdrawal**: Delayed withdrawal with randomized amounts and multi-hop routing

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Solana wallet (Phantom, Solflare, etc.)

### Installation

1. **Clone the repository**:
```bash
git clone <your-repo-url>
cd privacy
```

2. **Install dependencies**:
```bash
# Frontend
npm install

# Backend
cd backend
npm install
```

3. **Configure environment variables**:
```bash
# Backend - see backend/env.template
DATABASE_URL=postgresql://...
ENCRYPTION_KEY=<64-char-hex-key>
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
RELAYER_FEE_WALLET=<your-wallet>
TREASURY_WALLET_PRIVATE_KEY=<your-key>
USE_ENHANCED_PRIVACY=true

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SOLANA_NETWORK=mainnet
```

4. **Start development servers**:
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
npm run dev
```

5. **Open** [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
privacy/
├── src/                          # Frontend (Next.js)
│   ├── app/
│   │   ├── docs/                 # Documentation page
│   │   ├── layout.tsx            # Root layout
│   │   ├── page.tsx              # Main page
│   │   └── globals.css           # Global styles
│   └── components/
│       ├── TransferCard.tsx       # Main transfer interface
│       ├── WalletProvider.tsx    # Solana wallet adapter
│       └── ...
├── backend/                       # Backend service
│   ├── src/
│   │   ├── config/               # Database, Solana, constants
│   │   ├── controllers/          # API controllers
│   │   ├── routes/               # Express routes
│   │   ├── services/              # Business logic
│   │   │   ├── privacyService.ts
│   │   │   ├── enhancedPrivacyService.ts
│   │   │   ├── walletService.ts
│   │   │   └── ...
│   │   └── server.ts             # Express server
│   └── env.template              # Environment variables template
└── package.json
```

## API Reference

### Endpoints

- `GET /health` - Health check
- `GET /api/swap/config` - Get immutable configuration
- `POST /api/swap/prepare` - Prepare swap (get intermediate wallet)
- `POST /api/swap/initiate` - Initiate swap after deposit
- `GET /api/swap/status/:transactionId` - Get transaction status
- `GET /api/swap/recovery/:transactionId` - Check recovery availability
- `POST /api/swap/recovery/:transactionId` - Execute emergency recovery

## Database Schema

- `intermediate_wallets` - Encrypted intermediate wallet keypairs
- `swap_transactions` - Transaction records and status
- `mixing_windows` - Time-based mixing window tracking
- `encrypted_memos` - End-to-end encrypted transaction memos
- `recovery_tracking` - Emergency recovery state
- `deposit_counter` - Global deposit counter for recovery

## Technology Stack

### Frontend
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Blockchain**: Solana Web3.js
- **Wallets**: Solana Wallet Adapter

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Blockchain**: Solana Web3.js
- **Encryption**: AES-256-GCM

## Development

### Available Scripts

**Frontend:**
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server

**Backend:**
- `npm run dev` - Start development server (nodemon)
- `npm run build` - Compile TypeScript
- `npm run start` - Start production server

## Deployment

### Backend (Railway/Render)
- Set root directory to `backend`
- Build command: `npm install && npm run build`
- Start command: `npm start`
- Add all environment variables from `backend/env.template`

### Frontend (Vercel/Railway)
- Framework: Next.js (auto-detected)
- Build command: `npm run build`
- Add `NEXT_PUBLIC_API_URL` environment variable

## Documentation

For complete technical documentation, visit `/docs` in the application or see the documentation page source at `src/app/docs/page.tsx`.

The documentation covers:
- System Architecture
- Privacy Mechanisms
- Multi-Note Mixing Protocol
- Multi-Hop Routing
- Emergency Recovery System
- End-to-End Encryption
- Immutable Configuration
- Wallet Management
- API Reference
- Security Model

## Security Considerations

**Important**: This is production-ready code but should be audited before handling significant funds.

- All private keys are encrypted with AES-256-GCM
- Configuration is immutable (hardcoded)
- Emergency recovery system for edge cases
- Client-side key generation and decryption
- No server-side access to recovery keys

## License

MIT

## Disclaimer

This software is provided as-is. Use at your own risk. The authors are not responsible for any losses or damages resulting from the use of this software.
