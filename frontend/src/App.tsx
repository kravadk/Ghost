import React, { useMemo, useEffect } from 'react';
import { WalletProvider, useWallet } from "@demox-labs/aleo-wallet-adapter-react";
import { LeoWalletAdapter } from "@demox-labs/aleo-wallet-adapter-leo";
import { WalletAdapterNetwork, DecryptPermission } from "@demox-labs/aleo-wallet-adapter-base";
import LandingPage from './components/LandingPage';
import ChatInterface from './components/ChatInterface';

// One-time notice: EVM wallet errors in console are from other extensions, not this app
if (typeof window !== 'undefined' && !(window as any).__ghost_evm_notice_shown) {
  (window as any).__ghost_evm_notice_shown = true;
  console.info(
    '%cGhost uses Leo Wallet (Aleo) only. ' +
    'Errors about "ethereum" or from Razor/Nightly wallet are from other extensions and can be ignored. ' +
    'For best experience use only Leo Wallet on this site.',
    'color: #666; font-size: 11px;'
  );
}

const Content: React.FC = () => {
  const { publicKey, connecting, error } = useWallet();
  
  // Suppress wallet connection errors in console
  useEffect(() => {
    if (error) {
      const errorMsg = error?.message || String(error || '');
      const errorName = error?.name || '';
      
      // Only log critical wallet errors
      if (!errorMsg.includes('WalletNotSelected') && 
          !errorName.includes('WalletNotSelected') &&
          !errorMsg.includes('Failed to connect')) {
        console.error('❌ Wallet error:', error);
      }
    }
  }, [error]);
  
  return publicKey ? <ChatInterface /> : <LandingPage />;
};

function App() {
  const wallets = useMemo(
    () => [
      new LeoWalletAdapter({
        appName: "Ghost Messenger",
      }),
    ],
    []
  );

  return (
    <WalletProvider
      wallets={wallets}
      decryptPermission={DecryptPermission.OnChainHistory}
      network={WalletAdapterNetwork.TestnetBeta}
      autoConnect={false}
    >
      <div className="min-h-screen bg-brutal-white font-mono">
        <Content />
      </div>
    </WalletProvider>
  );
}

export default App;