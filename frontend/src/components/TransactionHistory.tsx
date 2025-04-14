// src/components/TransactionHistory.tsx
import { useState, useEffect } from 'react';
import contractService, { TransactionHistory } from '../services/ContractService';
import './TransactionHistory.css';

const TransactionHistoryComponent = () => {
  const [transactions, setTransactions] = useState<TransactionHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isWalletConnected, setIsWalletConnected] = useState(false);

  // Check if wallet is connected
  useEffect(() => {
    const checkWalletConnection = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          setIsWalletConnected(accounts && accounts.length > 0);
          
          if (accounts && accounts.length > 0) {
            loadTransactions(accounts[0]);
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

    checkWalletConnection();
    
    // Listen for account changes
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts: string[]) => {
        setIsWalletConnected(accounts && accounts.length > 0);
        if (accounts && accounts.length > 0) {
          loadTransactions(accounts[0]);
        } else {
          setTransactions([]);
        }
      });
    }
    
    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', () => {});
      }
    };
  }, []);

  // Load transactions
  const loadTransactions = async (address: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const history = contractService.getTransactionHistory(address);
      setTransactions(history);
      
      setLoading(false);
    } catch (err) {
      console.error('Failed to load transactions:', err);
      setError(`Failed to load transaction history: ${err instanceof Error ? err.message : String(err)}`);
      setLoading(false);
    }
  };

  if (!isWalletConnected) {
    return (
      <div className="transaction-history">
        <h2>Transaction History</h2>
        <div className="connect-wallet-message">
          <p>Please connect your wallet to view your transaction history.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="transaction-history loading">Loading transaction history...</div>;
  }

  if (error) {
    return (
      <div className="transaction-history">
        <h2>Transaction History</h2>
        <div className="error-message">{error}</div>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="transaction-history">
        <h2>Transaction History</h2>
        <div className="no-transactions-message">
          <p>You don't have any transactions yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="transaction-history">
      <h2>Transaction History</h2>
      <div className="transactions-list">
        {transactions.map((tx) => (
          <div key={tx.id} className={`transaction-card ${tx.type}`}>
            <div className="transaction-header">
              <h3>{tx.type === 'borrow' ? 'Borrowed' : 'Repaid'} {tx.tokenName}</h3>
              <span className="transaction-date">{tx.date}</span>
            </div>
            
            <div className="transaction-details">
              <div className="detail-row">
                <span>Loan ID:</span>
                <span>#{tx.loanId}</span>
              </div>
              <div className="detail-row">
                <span>Token Amount:</span>
                <span>{tx.tokenAmount} tokens</span>
              </div>
              <div className="detail-row">
                <span>Collateral:</span>
                <span>{tx.collateralAmount} ETH</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TransactionHistoryComponent;
