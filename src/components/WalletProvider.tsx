'use client';

import { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

export function WalletContextProvider({ children }: { children: React.ReactNode }) {
  // Use Helius RPC if API key is provided, otherwise fallback to public RPC
  const heliusApiKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY;
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'devnet' 
    ? WalletAdapterNetwork.Devnet 
    : WalletAdapterNetwork.Mainnet;
  
  const endpoint = useMemo(() => {
    if (heliusApiKey) {
      // Use Helius RPC
      const networkName = network === WalletAdapterNetwork.Devnet ? 'devnet' : 'mainnet';
      return `https://${networkName}.helius-rpc.com/?api-key=${heliusApiKey}`;
    }
    // Fallback to public RPC
    return clusterApiUrl(network);
  }, [network, heliusApiKey]);

  const wallets = useMemo(
    () => {
      // Create wallet adapters explicitly - only Solana wallets
      const walletAdapters = [
        new PhantomWalletAdapter(),
        new SolflareWalletAdapter(),
      ];
      
      // Filter to ensure:
      // 1. No duplicates (by wallet name)
      // 2. Only Solana wallets (exclude Ethereum wallets like MetaMask)
      const seenNames = new Set<string>();
      const uniqueWallets = walletAdapters.filter((wallet) => {
        const walletName = wallet.name;
        
        // Exclude Ethereum wallets
        if (walletName === 'MetaMask' || 
            walletName === 'Ethereum' ||
            walletName.toLowerCase().includes('ethereum') ||
            walletName.toLowerCase().includes('metamask')) {
          return false;
        }
        
        // Check for duplicates
        if (seenNames.has(walletName)) {
          console.warn(`Duplicate wallet detected: ${walletName}. Skipping.`);
          return false;
        }
        
        seenNames.add(walletName);
        return true;
      });
      
      return uniqueWallets;
    },
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

