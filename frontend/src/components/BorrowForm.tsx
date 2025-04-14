import { useState, useEffect } from 'react';
import contractService from '../services/ContractService';
import { TokenInfo } from '../services/ContractService';
import './BorrowForm.css';

interface BorrowFormProps {
  selectedTokenType: number | null;
  onSuccess?: () => void;
}

// Custom event for loan creation
export const LOAN_CREATED_EVENT = 'loanCreated';

const BorrowForm = ({ selectedTokenType, onSuccess }: BorrowFormProps) => {
  const [token, setToken] = useState<TokenInfo | null>(null);
  const [tokenAmount, setTokenAmount] = useState<string>('1');
  const [collateralAmount, setCollateralAmount] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [isWalletConnected, setIsWalletConnected] = useState<boolean>(false);

  // Check wallet connection status
  useEffect(() => {
    const checkWalletConnection = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          setIsWalletConnected(accounts && accounts.length > 0);
        } catch (err) {
          console.error('Failed to check wallet connection:', err);
          setIsWalletConnected(false);
        }
      }
    };

    checkWalletConnection();
    
    // Listen for account changes
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts: string[]) => {
        setIsWalletConnected(accounts && accounts.length > 0);
      });
    }
    
    return () => {
      // Clean up listeners when component unmounts
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', () => {});
      }
    };
  }, []);

  // Load token details when selected token changes
  useEffect(() => {
    const loadToken = async () => {
      if (selectedTokenType === null) return;
      
      try {
        const tokens = await contractService.getTokenDetails();
        const selectedToken = tokens.find(t => t.type === selectedTokenType);
        if (selectedToken) {
          setToken(selectedToken);
          // Initialize with 1 token
          setTokenAmount('1');
          // Set default collateral (150% of token value)
          const collateral = (parseFloat(selectedToken.value) * 1.5).toFixed(4);
          setCollateralAmount(collateral);
        }
      } catch (err) {
        console.error('Failed to load token details:', err);
        setError(`Error loading token details: ${err instanceof Error ? err.message : String(err)}`);
      }
    };

    loadToken();
  }, [selectedTokenType]);

  // Update collateral when token amount changes
  useEffect(() => {
    if (!token) return;
    
    try {
      const amount = parseFloat(tokenAmount) || 0;
      const tokenValue = parseFloat(token.value);
      // Calculate collateral (150% of token value * amount)
      const collateral = (tokenValue * amount * 1.5).toFixed(4);
      setCollateralAmount(collateral);
    } catch (err) {
      console.error('Calculation error:', err);
    }
  }, [tokenAmount, token]);

  const handleTokenAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTokenAmount(e.target.value);
  };

  const ensureWalletConnected = async (): Promise<boolean> => {
    if (!window.ethereum) {
      setError("MetaMask is not installed. Please install MetaMask to continue.");
      return false;
    }

    try {
      // Reconnect wallet to ensure connection is fresh
      await contractService.connectWallet();
      return true;
    } catch (err) {
      console.error("Failed to connect wallet:", err);
      setError(`Wallet connection failed: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  };

  const handleBorrow = async () => {
    if (!token || !tokenAmount || !collateralAmount) return;
    
    setIsProcessing(true);
    setError(null);
    
    try {
      // First ensure wallet is connected
      const connected = await ensureWalletConnected();
      if (!connected) {
        setIsProcessing(false);
        return;
      }
      
      // Call contract service to borrow tokens
      await contractService.borrowTokens(
        token.type,
        tokenAmount,
        collateralAmount
      );
      
      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent(LOAN_CREATED_EVENT, { 
        detail: { 
          tokenType: token.type,
          amount: tokenAmount,
          collateral: collateralAmount
        } 
      }));
      
      setSuccess(true);
      setIsProcessing(false);
      
      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
      
    } catch (err) {
      console.error('Borrowing failed:', err);
      let errorMessage = `Transaction failed: ${err instanceof Error ? err.message : String(err)}`;
      
      // Provide more helpful error messages
      if (errorMessage.includes('Contract not initialized')) {
        errorMessage = "Wallet connection issue. Please try disconnecting and reconnecting your wallet.";
      } else if (errorMessage.includes('insufficient funds')) {
        errorMessage = "Insufficient ETH to cover collateral and gas fees.";
      }
      
      setError(errorMessage);
      setIsProcessing(false);
    }
  };

  if (!token) {
    return null;
  }

  if (success) {
    return (
      <div className="borrow-form success">
        <h3>Transaction Successful!</h3>
        <p>You have successfully borrowed {tokenAmount} {token.name}.</p>
        <p>Your collateral of {collateralAmount} ETH has been locked.</p>
        <button 
          className="primary-button"
          onClick={() => setSuccess(false)}
        >
          Borrow More
        </button>
      </div>
    );
  }

  return (
    <div className="borrow-form">
      <h3>Borrow {token.name}</h3>
      
      <div className="form-group">
        <label>Token Value: {token.value} ETH</label>
        <label>Interest Rate: {token.rate}%</label>
      </div>
      
      <div className="form-group">
        <label htmlFor="tokenAmount">How many tokens would you like to borrow?</label>
        <input
          id="tokenAmount"
          type="number"
          min="0.1"
          step="0.1"
          value={tokenAmount}
          onChange={handleTokenAmountChange}
          disabled={isProcessing}
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="collateralAmount">Required Collateral (150%)</label>
        <input
          id="collateralAmount"
          type="text"
          value={`${collateralAmount} ETH`}
          disabled
        />
      </div>
      
      {!isWalletConnected ? (
        <div className="wallet-warning">
          <p>You need to connect your wallet before borrowing tokens.</p>
          <button 
            className="secondary-button"
            onClick={ensureWalletConnected}
          >
            Connect Wallet
          </button>
        </div>
      ) : (
        <button 
          className="primary-button"
          onClick={handleBorrow}
          disabled={isProcessing}
        >
          {isProcessing ? 'Processing...' : 'Borrow Tokens'}
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

export default BorrowForm;
