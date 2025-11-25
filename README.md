# Zurix - Private Solana Transfers

A privacy-focused Solana wallet transfer application that allows users to move funds between wallets without being tracked by snipers or blockchain analysis tools. Built with Next.js and Solana Web3.js.

## Features

- 🔒 **Advanced Private Transfers**: Multi-hop routing through 2-3 intermediate wallets with randomized delays
- 🛡️ **Enhanced Privacy**: Breaks transaction links at multiple points, making tracking extremely difficult
- ⏱️ **Randomized Timing**: Variable delays (3-20 seconds) break timing correlation patterns
- 👛 **Wallet Integration**: Support for Phantom, Solflare, and other Solana wallets
- 📊 **Transaction Tracking**: Real-time progress tracking for multi-step privacy swaps
- 🎨 **Modern UI**: Beautiful, responsive interface with dark mode support
- ⚡ **Built with Next.js**: Fast, modern web application framework

## How It Works

The application implements an advanced multi-hop privacy mechanism:

1. **Source Validation**: Validates the source wallet and checks balance
2. **First Intermediate Wallet**: User sends funds to first intermediate wallet
3. **Multi-Hop Routing**: Funds are routed through 2-3 intermediate wallets (randomly chosen)
   - Each hop includes randomized delays (3-20 seconds)
   - 70% of transactions use 3 hops for maximum privacy
4. **Privacy Delays**: Variable delays between hops break timing correlation
5. **Destination Transfer**: Final transfer to the destination wallet
6. **Verification**: Confirms transaction completion

This enhanced approach ensures that:
- **Multiple break points**: 2-3 intermediate wallets break the connection at multiple points
- **Randomized routing**: Variable hop count (2-3) prevents pattern detection
- **Timing obfuscation**: Randomized delays (3-20s) break timing correlation
- **Single-use wallets**: Each intermediate wallet is used only once
- **Strong protection**: Much harder to track than single-hop systems
- **Sniper protection**: Multiple hops make wallet movements difficult to follow

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- A Solana wallet (Phantom, Solflare, etc.)

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd privacy
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
privacy/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout with wallet providers
│   │   ├── page.tsx             # Main page
│   │   └── globals.css          # Global styles
│   └── components/
│       ├── WalletProvider.tsx   # Solana wallet adapter setup
│       ├── Providers.tsx        # Client component wrapper
│       └── PrivateSwap.tsx      # Main swap interface
├── public/                      # Static assets
└── package.json
```

## Important Notes

### Backend Setup

The application requires a backend service for full functionality:

1. **Backend Service**: 
   - Manages intermediate privacy wallets
   - Handles the actual fund routing
   - Implements secure key management
   - PostgreSQL database for transaction tracking

2. **Environment Variables**:
   - See `backend/env.template` for required configuration
   - Set up database connection
   - Configure Solana RPC endpoint
   - Set encryption keys

3. **Deployment**:
   - Backend can be deployed to Railway, Render, or similar
   - Frontend can be deployed to Vercel or Railway

## Technology Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Blockchain**: Solana Web3.js
- **Wallets**: Solana Wallet Adapter

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Security Considerations

⚠️ **This is a demonstration project**. Before deploying to production:

- Implement proper backend infrastructure
- Add comprehensive security measures
- Conduct security audits
- Ensure regulatory compliance
- Test thoroughly on devnet before mainnet

## Privacy Features

**Key Privacy Improvements:**
- ✅ Multi-hop routing (2-3 intermediate wallets)
- ✅ Randomized delays (3-20 seconds)
- ✅ Variable routing (prevents pattern detection)
- ✅ Single-use wallets (no connection between swaps)
- ✅ Enhanced mixing pools with time-based windows
- ✅ Amount splitting and obfuscation

## References

- [Houdini Swap Documentation](https://docs.houdiniswap.com/houdini-swap)
- [Solana Web3.js Documentation](https://solana-labs.github.io/solana-web3.js/)
- [Solana Wallet Adapter](https://github.com/solana-labs/wallet-adapter)

## License

MIT

## Disclaimer

This software is provided for educational and demonstration purposes. Use at your own risk. The authors are not responsible for any losses or damages resulting from the use of this software.
