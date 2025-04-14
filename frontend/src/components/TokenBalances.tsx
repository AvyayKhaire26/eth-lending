import { useState, useEffect } from 'react';
import contractService, { TokenBalance } from '../services/ContractService';
import './TokenBalances.css';

const TokenBalances = () => {
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isWalletConnected, setIsWalletConnected] = useState(false);

  // Check if wallet is connected and load balances
  useEffect(() => {
    const checkWalletAndLoadBalances = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          setIsWalletConnected(accounts && accounts.length > 0);
          
          if (accounts && accounts.length > 0) {
            await loadBalances(accounts[0]);
          } else {
            setLoading(false);
          }
        } catch (err) {
          console.error('Failed to check wallet connection:', err);
          setIsWalletConnected(false);
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    checkWalletAndLoadBalances();
    
    // Listen for account changes
    if (window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        setIsWalletConnected(accounts && accounts.length > 0);
        if (accounts && accounts.length > 0) {
          loadBalances(accounts[0]);
        } else {
          setBalances([]);
        }
      };
      
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      
      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      };
    }
  }, []);

  // Listen for loan events to refresh balances
  useEffect(() => {
    const handleLoanEvent = () => {
      if (isWalletConnected) {
        refreshBalances();
      }
    };

    window.addEventListener('loanCreated', handleLoanEvent);
    
    return () => {
      window.removeEventListener('loanCreated', handleLoanEvent);
    };
  }, [isWalletConnected]);

  // Load balances
  const loadBalances = async (address: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const userBalances = await contractService.getUserTokenBalances(address);
      setBalances(userBalances);
      
      setLoading(false);
    } catch (err) {
      console.error('Failed to load balances:', err);
      setError(`Failed to load token balances: ${err instanceof Error ? err.message : String(err)}`);
      setLoading(false);
    }
  };

  const refreshBalances = async () => {
    if (window.ethereum) {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts && accounts.length > 0) {
        await loadBalances(accounts[0]);
      }
    }
  };

  if (!isWalletConnected) {
    return (
      <div className="token-balances">
        <h2>Your Token Balances</h2>
        <div className="connect-wallet-message">
          <p>Please connect your wallet to view your token balances.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="token-balances loading">Loading token balances...</div>;
  }

  if (error) {
    return (
      <div className="token-balances">
        <h2>Your Token Balances</h2>
        <div className="error-message">{error}</div>
        <button className="refresh-button" onClick={refreshBalances}>
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="token-balances">
      <div className="balances-header">
        <h2>Your Token Balances</h2>
        <button className="refresh-button" onClick={refreshBalances} title="Refresh balances">
          🔄 Refresh
        </button>
      </div>
      
      <div className="balances-list">
        {balances.map((balance) => (
          <div key={balance.tokenType} className="balance-card">
            <h3>{balance.tokenName}</h3>
            <div className="balance-amount">
              <span>{parseFloat(balance.balance).toFixed(4)} tokens</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TokenBalances;
