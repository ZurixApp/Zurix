import { Connection, Cluster, clusterApiUrl } from '@solana/web3.js';
import dotenv from 'dotenv';

dotenv.config();

// Determine network from environment or RPC URL
function getNetwork(): Cluster {
  const networkEnv = process.env.SOLANA_NETWORK;
  if (networkEnv === 'devnet') return 'devnet';
  if (networkEnv === 'testnet') return 'testnet';
  
  const rpcUrl = process.env.SOLANA_RPC_URL || '';
  if (rpcUrl.includes('devnet')) return 'devnet';
  if (rpcUrl.includes('testnet')) return 'testnet';
  return 'mainnet-beta';
}

// Build RPC URL - prefer Helius if API key is provided
function getRpcUrl(): string {
  const heliusApiKey = process.env.HELIUS_API_KEY;
  const network = getNetwork();
  
  if (heliusApiKey) {
    // Use Helius RPC
    const networkName = network === 'devnet' ? 'devnet' : 'mainnet';
    return `https://${networkName}.helius-rpc.com/?api-key=${heliusApiKey}`;
  }
  
  // Fallback to custom RPC URL or public RPC
  if (process.env.SOLANA_RPC_URL) {
    return process.env.SOLANA_RPC_URL;
  }
  
  return clusterApiUrl(network);
}

// Create Solana connection
const rpcUrl = getRpcUrl();
export const connection = new Connection(rpcUrl, 'confirmed');

export const network = getNetwork();

console.log(`🔗 Connected to Solana ${network}`);
if (process.env.HELIUS_API_KEY) {
  console.log(`✅ Using Helius RPC`);
} else {
  console.log(`⚠️  Using public RPC (consider adding HELIUS_API_KEY for better performance)`);
}

