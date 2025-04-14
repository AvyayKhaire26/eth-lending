import { useState, useEffect } from 'react';
import contractService from '../services/ContractService';

const WalletConnect = () => {
  const [account, setAccount] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);

  // Enhanced connection check with session storage
  useEffect(() => {
    const checkConnection = async () => {
      // Check session storage first for faster UI
      const storedAddress = sessionStorage.getItem('walletAddress');
      if (storedAddress) {
        setAccount(storedAddress);
      }
      
      // Only check if ethereum is available (MetaMask installed)
      if (window.ethereum) {
        try {
          // Get currently connected accounts
          const provider = new contractService.ethers.BrowserProvider(window.ethereum);
          const accounts = await provider.listAccounts();
          
          if (accounts.length > 0) {
            const address = accounts[0].address;
            setAccount(address);
            sessionStorage.setItem('walletAddress', address);
            
            // Reinitialize contract service with current wallet
            await contractService.connectWallet();
            
            const network = await provider.getNetwork();
            setChainId(Number(network.chainId));
          } else if (storedAddress) {
            // Clear session if wallet is no longer connected
            sessionStorage.removeItem('walletAddress');
            setAccount(null);
          }
        } catch (err) {
          console.error("Failed to check wallet connection:", err);
          // Don't clear stored address on error, as it might be temporary
        }
      }
    };

    checkConnection();
    
    // Add event listeners for account and chain changes
    if (window.ethereum) {
      const handleAccountsChanged = async (accounts: string[]) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          sessionStorage.setItem('walletAddress', accounts[0]);
          
          // Reinitialize contract service with new wallet
          await contractService.connectWallet();
        } else {
          setAccount(null);
          sessionStorage.removeItem('walletAddress');
        }
      };
      
      const handleChainChanged = (chainId: string) => {
        setChainId(parseInt(chainId, 16));
      };
      
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
      
      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, []);

  // Handle wallet connection
  const connectWallet = async () => {
    if (!window.ethereum) {
      setError("MetaMask is not installed. Please install MetaMask to continue.");
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);
      
      const signer = await contractService.connectWallet();
      const address = await signer.getAddress();
      setAccount(address);
      sessionStorage.setItem('walletAddress', address);
      
      // Get connected chain ID
      const provider = new contractService.ethers.BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();
      setChainId(Number(network.chainId));
      
      // Dispatch a custom event to notify other components
      window.dispatchEvent(new CustomEvent('walletConnected', { detail: { address } }));
      
      setIsConnecting(false);
    } catch (err) {
      console.error("Failed to connect wallet:", err);
      setError(`Failed to connect wallet: ${err instanceof Error ? err.message : String(err)}`);
      setIsConnecting(false);
    }
  };

  // Format account address for display
  const formatAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  return (
    <div className="wallet-connect">
      {account ? (
        <div className="wallet-info">
          <div className="wallet-address">
            <span>Connected: {formatAddress(account)}</span>
          </div>
          <div className="network-info">
            <span>Network: {chainId === 31337 ? 'Localhost' : chainId === 1 ? 'Ethereum' : `Chain ID: ${chainId}`}</span>
          </div>
        </div>
      ) : (
        <button 
          className="connect-button" 
          onClick={connectWallet}
          disabled={isConnecting}
        >
          {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </button>
      )}
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
    </div>
  );
};

export default WalletConnect;
