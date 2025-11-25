'use client';

import { WalletContextProvider } from './WalletProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return <WalletContextProvider>{children}</WalletContextProvider>;
}

