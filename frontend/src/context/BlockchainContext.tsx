import React, { createContext, useContext, useState, useEffect } from 'react';
import contractService from '../services/ContractService';
import { TokenInfo } from '../services/ContractService';

// Define the context shape
interface BlockchainContextType {
  isInitialized: boolean;
  isConnecting: boolean;
  account: string | null;
  chainId: number | null;
  tokens: TokenInfo[];
  error: string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
}

// Create context with default values
const BlockchainContext = createContext<BlockchainContextType>({
  isInitialized: false,
  isConnecting: false,
  account: null,
  chainId: null,
  tokens: [],
  error: null,
  connectWallet: async () => {},
  disconnectWallet: () => {}
});

// Custom hook to use the blockchain context
export const useBlockchain = () => useContext(BlockchainContext);

// Provider component
export const BlockchainProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Initialize the blockchain service
  useEffect(() => {
    const initialize = async () => {
      try {
        await contractService.init();
        const tokenDetails = await contractService.getTokenDetails();
        setTokens(tokenDetails);
        setIsInitialized(true);
        
        // Check if wallet is already connected
        if (window.ethereum) {
          const provider = new contractService.ethers.BrowserProvider(window.ethereum);
          const accounts = await provider.listAccounts();
          
          if (accounts.length > 0) {
            setAccount(accounts[0].address);
            const network = await provider.getNetwork();
            setChainId(Number(network.chainId));
          }
        }
      } catch (err) {
        console.error('Failed to initialize blockchain:', err);
        setError(`Initialization error: ${err instanceof Error ? err.message : String(err)}`);
      }
    };

    initialize();
  }, []);

  // Listen for account changes
  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        console.log('Accounts changed:', accounts);
        setAccount(accounts.length > 0 ? accounts[0] : null);
      };

      const handleChainChanged = (chainId: string) => {
        console.log('Chain changed:', chainId);
        setChainId(parseInt(chainId, 16));
        // Reload the page as recommended by MetaMask
        window.location.reload();
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      // Cleanup listeners
      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, []);

  // Connect wallet function
  const connectWallet = async () => {
    if (!window.ethereum) {
      setError("MetaMask is not installed. Please install MetaMask to continue.");
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);
      
      const signer = await contractService.connectWallet();
      setAccount(await signer.getAddress());
      
      // Get connected chain ID
      const provider = new contractService.ethers.BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();
      setChainId(Number(network.chainId));
      
      setIsConnecting(false);
    } catch (err) {
      console.error("Failed to connect wallet:", err);
      setError(`Failed to connect wallet: ${err instanceof Error ? err.message : String(err)}`);
      setIsConnecting(false);
    }
  };

  // Disconnect wallet function (for UI purposes)
  const disconnectWallet = () => {
    setAccount(null);
    // Note: This doesn't actually disconnect MetaMask, just resets the state
    // MetaMask doesn't support programmatic disconnection for security reasons
  };

  // Context value
  const value: BlockchainContextType = {
    isInitialized,
    isConnecting,
    account,
    chainId,
    tokens,
    error,
    connectWallet,
    disconnectWallet
  };

  return (
    <BlockchainContext.Provider value={value}>
      {children}
    </BlockchainContext.Provider>
  );
};
