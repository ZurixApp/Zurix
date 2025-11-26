'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Backend API URL - defaults to localhost:3001 in development
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface SwapStep {
  step: number;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  txSignature?: string;
}

export default function TransferCard() {
  const wallet = useWallet();
  const { publicKey, sendTransaction, disconnect, connected } = wallet;
  const { connection } = useConnection();
  const [destinationWallet, setDestinationWallet] = useState('');
  const [amount, setAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [swapSteps, setSwapSteps] = useState<SwapStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [transactionStatus, setTransactionStatus] = useState<'pending' | 'processing' | 'completed' | 'failed' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const visualEffectRef = useRef<HTMLDivElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const validateWalletAddress = (address: string): boolean => {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  };

  // Fetch SOL balance when wallet is connected
  useEffect(() => {
    const fetchBalance = async () => {
      if (!publicKey || !connection) {
        setBalance(null);
        return;
      }

      setIsLoadingBalance(true);
      try {
        const balanceLamports = await connection.getBalance(publicKey);
        const balanceSOL = balanceLamports / LAMPORTS_PER_SOL;
        setBalance(balanceSOL);
      } catch (error) {
        console.error('Error fetching balance:', error);
        setBalance(null);
      } finally {
        setIsLoadingBalance(false);
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 10000);
    return () => clearInterval(interval);
  }, [publicKey, connection]);

  // Poll for transaction status in the background
  useEffect(() => {
    if (!transactionId) {
      // Clear any existing polling
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    const pollTransactionStatus = async () => {
      try {
        const statusResponse = await fetch(`${API_BASE_URL}/api/swap/status/${transactionId}`);
        if (!statusResponse.ok) {
          return;
        }

        let statusData;
        try {
          const text = await statusResponse.text();
          statusData = text ? JSON.parse(text) : null;
        } catch (e) {
          console.error('Failed to parse status response:', e);
          return;
        }
        
        if (statusData && statusData.success && statusData.transaction) {
          const txStatus = statusData.transaction.status;
          setTransactionStatus(txStatus);

          if (txStatus === 'completed') {
            // Update steps to show completion
            setSwapSteps((prevSteps) => {
              const updatedSteps = prevSteps.map((step) => {
                if (step.status === 'processing') {
                  return { ...step, status: 'completed' as const };
                }
                return step;
              });
              return updatedSteps;
            });

            // Refresh balance
            if (publicKey && connection) {
              try {
                const balanceLamports = await connection.getBalance(publicKey);
                const balanceSOL = balanceLamports / LAMPORTS_PER_SOL;
                setBalance(balanceSOL);
              } catch (error) {
                console.error('Error refreshing balance:', error);
              }
            }

            // Clear polling interval
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }

            // Clear transaction ID after a delay to allow user to see completion
            setTimeout(() => {
              setTransactionId(null);
              setTransactionStatus(null);
            }, 10000); // Clear after 10 seconds

            setError(null);
          } else if (txStatus === 'failed') {
            setError(statusData.transaction.error_message || 'Transaction failed');
            setTransactionStatus('failed');
            
            // Update steps to show error
            setSwapSteps((prevSteps) => {
              const updatedSteps = prevSteps.map((step) => {
                if (step.status === 'processing') {
                  return { ...step, status: 'error' as const };
                }
                return step;
              });
              return updatedSteps;
            });

            // Clear polling interval
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
          } else {
            // Still processing
            setTransactionStatus('processing');
          }
        }
      } catch (error) {
        console.error('Error polling transaction status:', error);
      }
    };

    // Poll immediately, then every 3 seconds
    pollTransactionStatus();
    pollingIntervalRef.current = setInterval(pollTransactionStatus, 3000);

    // Cleanup on unmount or when transactionId changes
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [transactionId, publicKey, connection]);

  // 3D card effect - applied to visual layer only, content stays flat for clicks
  useEffect(() => {
    const container = containerRef.current;
    const visualEffect = visualEffectRef.current;
    if (!container || !visualEffect) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      // Reduced rotation intensity for subtle effect
      const rotateX = ((y - centerY) / centerY) * -3;
      const rotateY = ((x - centerX) / centerX) * 3;

      visualEffect.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    };

    const handleMouseLeave = () => {
      if (visualEffect) {
        visualEffect.style.transform = 'perspective(1000px) rotateX(0) rotateY(0)';
      }
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  // Helper function to verify wallet connection state
  const verifyWalletConnection = (): { 
    publicKey: PublicKey; 
    sendTransaction: typeof wallet.sendTransaction;
  } => {
    // Get the absolute latest wallet state
    const currentWallet = wallet;
    
    // Check adapter's internal connection state FIRST - this is what sendTransaction checks
    // Use type assertion to access adapter property which exists but isn't in public types
    const walletWithAdapter = currentWallet as any;
    if (walletWithAdapter.adapter) {
      const adapter = walletWithAdapter.adapter;
      
      // The adapter's connected property is what sendTransaction checks internally
      if (adapter.connected === false) {
        throw new Error('Wallet adapter reports not connected. Please reconnect your wallet.');
      }
      
      // Check readyState if available
      if (adapter.readyState === 'NotFound' || adapter.readyState === 'Disconnect') {
        throw new Error('Wallet adapter is not ready. Please reconnect your wallet.');
      }
    }
    
    // Then check the hook's state
    if (!currentWallet.connected) {
      throw new Error('Wallet is not connected. Please connect your wallet and try again.');
    }
    
    if (!currentWallet.publicKey) {
      throw new Error('Wallet public key is not available. Please reconnect your wallet.');
    }
    
    if (!currentWallet.sendTransaction) {
      throw new Error('Wallet sendTransaction function is not available. Please reconnect your wallet.');
    }
    
    if (typeof currentWallet.sendTransaction !== 'function') {
      throw new Error('Wallet sendTransaction is not a function. Please reconnect your wallet.');
    }
    
    return {
      publicKey: currentWallet.publicKey,
      sendTransaction: currentWallet.sendTransaction,
    };
  };

  const executePrivateSwap = useCallback(async () => {
    // Initial validation - check wallet state
    let walletState;
    try {
      walletState = verifyWalletConnection();
    } catch (err: any) {
      setError(err.message || 'Please connect your wallet first');
      return;
    }

    if (!destinationWallet || !amount) {
      setError('Please fill in all fields');
      return;
    }

    if (!validateWalletAddress(destinationWallet)) {
      setError('Invalid wallet address');
      return;
    }

    const amountNum = parseFloat(amount);
    const MIN_AMOUNT = 0.03;
    
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Invalid amount');
      return;
    }
    
    if (amountNum < MIN_AMOUNT) {
      setError(`Minimum swap amount is ${MIN_AMOUNT} SOL`);
      return;
    }

    setIsProcessing(true);
    setError(null);

    const steps: SwapStep[] = [
      { step: 1, description: 'Validating source wallet and balance', status: 'pending' },
      { step: 2, description: 'Preparing swap with backend', status: 'pending' },
      { step: 3, description: 'Transferring funds to intermediate wallet', status: 'pending' },
      { step: 4, description: 'Initiating swap with backend', status: 'pending' },
      { step: 5, description: 'Backend processing transaction', status: 'pending' },
      { step: 6, description: 'Verifying transaction completion', status: 'pending' },
    ];
    setSwapSteps(steps);

    try {
      // Re-verify wallet connection before starting
      walletState = verifyWalletConnection();
      const currentPublicKey = walletState.publicKey;
      const currentSendTransaction = walletState.sendTransaction;
      
      const destPubkey = new PublicKey(destinationWallet);
      const amountLamports = amountNum * LAMPORTS_PER_SOL;

      // Step 1: Validate source wallet
      steps[0].status = 'processing';
      setSwapSteps([...steps]);
      
      const sourceBalance = await connection.getBalance(currentPublicKey);
      if (sourceBalance < amountLamports) {
        throw new Error('Insufficient balance in source wallet');
      }
      steps[0].status = 'completed';
      setSwapSteps([...steps]);

      // Step 2: Prepare swap with backend - get intermediate wallet
      steps[1].status = 'processing';
      setSwapSteps([...steps]);
      
      console.log('Preparing swap with backend:', `${API_BASE_URL}/api/swap/prepare`);
      const prepareResponse = await fetch(`${API_BASE_URL}/api/swap/prepare`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceWallet: currentPublicKey.toString(),
          destinationWallet: destinationWallet,
          amount: amountNum,
        }),
      });

      if (!prepareResponse.ok) {
        let errorMessage = 'Failed to prepare swap';
        try {
          const errorText = await prepareResponse.text();
          if (errorText) {
            try {
              const errorData = JSON.parse(errorText);
              errorMessage = errorData.error || errorMessage;
            } catch {
              errorMessage = errorText || errorMessage;
            }
          }
        } catch {
          errorMessage = `Backend returned ${prepareResponse.status}: ${prepareResponse.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const prepareData = await prepareResponse.json();
      if (!prepareData.success || !prepareData.intermediateWallet) {
        throw new Error('Invalid response from backend');
      }

      const intermediateWalletPubkey = new PublicKey(prepareData.intermediateWallet.publicKey);
      const intermediateWalletId = prepareData.intermediateWallet.walletId;
      
      // Store recovery key securely (client-side only)
      if (prepareData.recovery?.recoveryKey) {
        // Store in sessionStorage (user should save this)
        sessionStorage.setItem(`recovery_${intermediateWalletId}`, prepareData.recovery.recoveryKey);
        console.log('🔑 Recovery key generated - save this securely!');
      }
      
      steps[1].status = 'completed';
      setSwapSteps([...steps]);

      // Step 3: Transfer to intermediate wallet
      steps[2].status = 'processing';
      setSwapSteps([...steps]);
      
      // CRITICAL: Re-verify wallet connection right before transaction
      // Wallet might have disconnected during async API calls
      walletState = verifyWalletConnection();
      const txPublicKey = walletState.publicKey;

      const transaction1 = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: txPublicKey,
          toPubkey: intermediateWalletPubkey,
          lamports: amountLamports,
        })
      );

      // Get recent blockhash for the transaction
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      transaction1.recentBlockhash = blockhash;
      transaction1.feePayer = txPublicKey;

      let signature1: string;
      
      try {
        // Final verification right before sending
        walletState = verifyWalletConnection();
        const finalPublicKey = walletState.publicKey;

        // Ensure transaction fee payer matches the connected wallet
        if (!transaction1.feePayer || !transaction1.feePayer.equals(finalPublicKey)) {
          transaction1.feePayer = finalPublicKey;
        }
        
        // Verify sendTransaction is available
        if (!wallet.sendTransaction) {
          throw new Error('Wallet sendTransaction is not available. Please reconnect your wallet.');
        }
        
        console.log('Sending transaction to wallet...', {
          from: finalPublicKey.toString(),
          to: intermediateWalletPubkey.toString(),
          amount: amountLamports,
        });
        
        // Send transaction - this should trigger the wallet popup
        signature1 = await wallet.sendTransaction(transaction1, connection, {
          skipPreflight: false,
        });
        
        console.log('Transaction sent, signature:', signature1);
      } catch (error: any) {
        const errorMessage = error?.message || error?.toString() || '';
        const errorString = String(errorMessage).toLowerCase();
        
        console.error('Transaction send error:', error);
        
        // Check if error is due to wallet disconnection
        if (errorString.includes('not connected') || 
            errorString.includes('disconnected') || 
            errorString.includes('wallet not connected') ||
            errorString.includes('connection lost') ||
            errorString.includes('not been authorized') ||
            errorString.includes('not authorized')) {
          throw new Error('Wallet disconnected or not authorized. Please reconnect your wallet, ensure it is unlocked, and try again.');
        }
        if (errorString.includes('user rejected') || 
            errorString.includes('user cancelled') ||
            errorString.includes('rejected')) {
          throw new Error('Transaction was rejected. Please approve the transaction in your wallet.');
        }
        throw new Error(`Transaction failed: ${errorMessage || 'Unknown error'}`);
      }

      await connection.confirmTransaction(signature1, 'confirmed');
      steps[2].status = 'completed';
      steps[2].txSignature = signature1;
      setSwapSteps([...steps]);

      // Step 4: Initiate swap with backend
      steps[3].status = 'processing';
      setSwapSteps([...steps]);
      
      // Get recovery key from sessionStorage
      const recoveryKey = sessionStorage.getItem(`recovery_${intermediateWalletId}`);
      
      const initiateResponse = await fetch(`${API_BASE_URL}/api/swap/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceWallet: walletState.publicKey.toString(),
          destinationWallet: destinationWallet,
          amount: amountNum,
          sourceTxSignature: signature1,
          intermediateWalletId: intermediateWalletId,
          recoveryKey: recoveryKey, // Include recovery key for emergency recovery
        }),
      });

      if (!initiateResponse.ok) {
        let errorMessage = 'Failed to initiate swap';
        try {
          const errorText = await initiateResponse.text();
          if (errorText) {
            try {
              const errorData = JSON.parse(errorText);
              errorMessage = errorData.error || errorMessage;
            } catch {
              errorMessage = errorText || errorMessage;
            }
          }
        } catch {
          errorMessage = `Backend returned ${initiateResponse.status}: ${initiateResponse.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const initiateData = await initiateResponse.json();
      if (!initiateData.success || !initiateData.transactionId) {
        throw new Error('Invalid response from backend');
      }

      setTransactionId(initiateData.transactionId);
      steps[3].status = 'completed';
      setSwapSteps([...steps]);

      // Step 5: Backend is processing - poll for status
      steps[4].status = 'processing';
      setSwapSteps([...steps]);
      
      // Poll for transaction status
      let statusCheckCount = 0;
      const maxStatusChecks = 60; // Check for up to 5 minutes (60 * 5 seconds)
      
      const checkStatus = async (): Promise<boolean> => {
        try {
          const statusResponse = await fetch(`${API_BASE_URL}/api/swap/status/${initiateData.transactionId}`);
          if (!statusResponse.ok) {
            return false;
          }
          
          let statusData;
          try {
            const text = await statusResponse.text();
            statusData = text ? JSON.parse(text) : null;
          } catch (e) {
            console.error('Failed to parse status response:', e);
            return;
          }
          
          if (statusData && statusData.success && statusData.transaction) {
            const txStatus = statusData.transaction.status;
            
            if (txStatus === 'completed') {
              steps[4].status = 'completed';
              steps[5].status = 'completed';
              setSwapSteps([...steps]);
              return true;
            } else if (txStatus === 'failed') {
              throw new Error(statusData.transaction.error_message || 'Transaction failed');
            }
          }
          
          return false;
        } catch (error) {
          console.error('Error checking status:', error);
          return false;
        }
      };

      // Poll every 5 seconds
      while (statusCheckCount < maxStatusChecks) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        const isComplete = await checkStatus();
        if (isComplete) {
          break;
        }
        statusCheckCount++;
      }

      if (statusCheckCount >= maxStatusChecks) {
        steps[4].description = 'Backend processing (this may take a few minutes) - checking in background...';
        steps[4].status = 'processing';
        steps[5].status = 'processing';
        steps[5].description = 'Monitoring transaction status';
        setSwapSteps([...steps]);
        // Don't throw error, transaction is being processed by backend
        // The useEffect hook will continue polling in the background
      } else {
        // Transaction completed during initial polling
        setError(null);
        
        // Refresh balance - verify wallet is still connected
        try {
          walletState = verifyWalletConnection();
          const newBalance = await connection.getBalance(walletState.publicKey);
          setBalance(newBalance / LAMPORTS_PER_SOL);
        } catch {
          // Wallet disconnected after transaction, balance will update on reconnect
        }
      }
    } catch (err: any) {
      setError(err.message || 'Transaction failed');
      const currentStep = steps.findIndex(s => s.status === 'processing');
      if (currentStep >= 0) {
        steps[currentStep].status = 'error';
        setSwapSteps([...steps]);
      }
    } finally {
      setIsProcessing(false);
    }
  }, [wallet, connection, destinationWallet, amount]);

  return (
    <div className="lg:col-span-5 relative h-[600px] flex items-center justify-center z-10 opacity-0 animate-fade-up holo-container" 
         ref={containerRef}
         style={{ animationDelay: '1.8s', animationFillMode: 'forwards' }}>
      
      {/* Rotating Rings */}
      <div className="absolute w-[550px] h-[550px] border border-wine-900/40 rounded-full animate-[spin_60s_linear_infinite]"></div>
      <div className="absolute w-[450px] h-[450px] border border-wine-900/40 rounded-full animate-[spin_40s_linear_infinite_reverse]"></div>
      
      {/* The Transfer Interface */}
      <div className="holo-card w-full max-w-md rounded-xl p-8 relative z-10" ref={cardRef}>
        {/* Visual 3D effect layer - doesn't interfere with clicks */}
        <div 
          ref={visualEffectRef}
          className="absolute inset-0 rounded-xl pointer-events-none transition-transform duration-100 will-change-transform"
          style={{ 
            background: 'linear-gradient(125deg, transparent 30%, rgba(166, 28, 49, 0.05) 40%, rgba(255,255,255,0.1) 50%, rgba(166, 28, 49, 0.05) 60%, transparent 70%)',
            backgroundSize: '200% 200%',
            animation: 'holoShimmer 8s infinite linear',
            zIndex: 1
          }}
        ></div>
        
        {/* Actual content - stays flat for reliable clicks */}
        <div className="relative z-10" style={{ transform: 'translateZ(0)' }}>
        {/* Card Header */}
        <div className="flex justify-between items-start mb-8 border-b border-white/10 pb-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-1">Secure Channel</div>
            <div className="font-serif text-white text-lg tracking-widest">TRANSFER</div>
          </div>
          <div className="w-8 h-8 flex items-center justify-center border border-wine-500/30 rounded-full">
            <i className="fas fa-fingerprint text-wine-500"></i>
          </div>
        </div>

        {/* Wallet Connection */}
        {!publicKey && (
          <div className="mb-6 [&_button]:!bg-transparent [&_button]:!border [&_button]:!border-wine-500/30 [&_button]:!text-white [&_button]:hover:!bg-wine-900/20 [&_button]:!rounded-none [&_button]:!text-xs [&_button]:!tracking-[0.2em] [&_button]:!uppercase [&_button]:!font-light [&_button]:!w-full [&_button]:!py-3">
            <WalletMultiButton />
          </div>
        )}

        {publicKey && (
          <div className="mb-6 p-3 bg-black/20 border border-white/5 rounded relative z-10">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="text-[9px] uppercase tracking-[0.2em] text-gray-500 mb-1">Connected</div>
                <div className="text-xs font-mono text-white">
                  {publicKey.toString().slice(0, 4)}...{publicKey.toString().slice(-4)}
                </div>
                {balance !== null && (
                  <div className="text-xs text-wine-500 mt-1">
                    {balance.toFixed(4)} SOL
                  </div>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  disconnect();
                }}
                className="ml-3 px-3 py-1.5 text-[8px] uppercase tracking-[0.2em] text-gray-400 hover:text-wine-500 border border-white/10 hover:border-wine-500/30 transition-all duration-300 relative z-20 cursor-pointer"
                title="Disconnect wallet"
                type="button"
              >
                <i className="fas fa-times mr-1"></i>
                Disconnect
              </button>
            </div>
          </div>
        )}

        {/* Transfer Form */}
        <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); executePrivateSwap(); }}>
          <div className="space-y-2">
            <label className="text-[9px] uppercase tracking-[0.2em] text-gray-400 flex items-center gap-2">
              <span className="text-wine-500">+</span> Recipient Identity
            </label>
            <input
              type="text"
              value={destinationWallet}
              onChange={(e) => setDestinationWallet(e.target.value)}
              placeholder="Solana Address..."
              className="w-full p-3 rounded-none luxury-input text-xs tracking-widest font-mono"
              disabled={isProcessing || !publicKey}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[9px] uppercase tracking-[0.2em] text-gray-400">Asset</label>
              <select className="w-full p-3 rounded-none luxury-input text-xs tracking-widest uppercase" disabled={isProcessing}>
                <option>SOL (Shielded)</option>
                <option>USDC (SPL)</option>
                <option>JUP (Aggregated)</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[9px] uppercase tracking-[0.2em] text-gray-400">Amount</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0.03"
                className="w-full p-3 rounded-none luxury-input text-xs tracking-widest font-mono text-right"
                disabled={isProcessing || !publicKey}
              />
            </div>
          </div>

          <div className="pt-2">
            <div className="flex justify-between text-[9px] uppercase tracking-[0.1em] text-gray-500 mb-2">
              <span>Relayer Fee (0.05%)</span>
              <span className="text-wine-500">~ {amount ? (parseFloat(amount) * 0.0005).toFixed(5) : '0.00000'} SOL</span>
            </div>
            <div className="h-[1px] w-full bg-gradient-to-r from-wine-900/50 to-transparent"></div>
          </div>

          {error && (
            <div className="text-[9px] text-wine-500 uppercase tracking-[0.1em]">
              {error}
            </div>
          )}

          {transactionStatus === 'completed' && !error && (
            <div className="text-[9px] text-green-400 uppercase tracking-[0.1em] animate-pulse">
              ✓ Transaction completed successfully
            </div>
          )}

          {transactionStatus === 'processing' && transactionId && (
            <div className="text-[9px] text-wine-500 uppercase tracking-[0.1em]">
              ⏳ Processing transaction... (checking status)
            </div>
          )}

          <button
            type="submit"
            disabled={isProcessing || !publicKey}
            className="w-full py-4 mt-2 btn-gold text-xs tracking-[0.3em] uppercase font-bold group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="relative z-10 flex items-center justify-center gap-3">
              {isProcessing ? 'Processing...' : 'Initialize Transfer'} <i className="fas fa-arrow-right group-hover:translate-x-1 transition-transform"></i>
            </span>
          </button>
        </form>

        {/* Transaction Steps */}
        {swapSteps.length > 0 && (
          <div className="mt-6 space-y-2 max-h-48 overflow-y-auto">
            {swapSteps.map((step) => (
              <div
                key={step.step}
                className={`flex items-center gap-2 text-[8px] uppercase tracking-[0.1em] ${
                  step.status === 'completed'
                    ? 'text-green-400'
                    : step.status === 'processing'
                    ? 'text-wine-500 animate-pulse'
                    : step.status === 'error'
                    ? 'text-red-400'
                    : 'text-gray-500'
                }`}
              >
                <span>
                  {step.status === 'completed' ? '✓' : step.status === 'error' ? '✗' : '○'}
                </span>
                <span>{step.description}</span>
              </div>
            ))}
          </div>
        )}
        
        {/* Decorative Chip */}
        <div className="absolute bottom-4 right-4 opacity-20 z-0">
          <i className="fas fa-shield-alt text-4xl text-white"></i>
        </div>
        </div>
      </div>
    </div>
  );
}

