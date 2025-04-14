// src/components/UserLoans.tsx
import { useState, useEffect, useCallback } from 'react';
import contractService from '../services/ContractService';
import { LoanInfo } from '../services/ContractService';
import { LOAN_CREATED_EVENT } from './BorrowForm';
import './UserLoans.css';

const UserLoans = () => {
  const [loans, setLoans] = useState<LoanInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingLoanId, setProcessingLoanId] = useState<number | null>(null);
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [isWalletReady, setIsWalletReady] = useState(false);
  const [isContractInitialized, setIsContractInitialized] = useState(false);
  const [repayMethod, setRepayMethod] = useState<string | null>(null);
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(Date.now());
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);


  // Memoize loadLoans to prevent unnecessary recreations
  const loadLoans = useCallback(async (isRetry = false) => {
    if (!isWalletReady) {
      if (isRetry) console.log("Wallet not ready yet during retry attempt");
      setLoans([]);
      if (!isRetry) setLoading(false);
      return;
    }
    
    try {
      if (!isRetry) setLoading(true);
      setError(null);
      
      // Ensure contract is initialized
      if (!contractService.isInitialized) {
        console.log("Initializing contract service before loading loans...");
        await contractService.init();
        setIsContractInitialized(true);
      }
      
      // Ensure wallet is connected to contract
      console.log("Ensuring wallet connection before loading loans...");
      await contractService.connectWallet();
      
      // Add a delay to ensure contract is fully ready
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log("Fetching user loans...");
      const userLoans = await contractService.getUserLoans();
      console.log('Loaded loans:', userLoans);
      setLoans(userLoans);
      setLastRefreshTime(Date.now());
      
      // Reset retry counter on success
      setRetryAttempt(0);
      
      if (!isRetry) setLoading(false);
      setInitialLoadComplete(true);
      
      // Store successful load in session
      sessionStorage.setItem('loansLastLoaded', Date.now().toString());
      
      return userLoans;
    } catch (err) {
      console.error('Failed to load loans:', err);
      
      if (isRetry) {
        // Just log errors during auto-retry
        console.log(`Auto-retry attempt ${retryAttempt} failed`);
        return;
      }
      
      setError(`Failed to load loans: ${err instanceof Error ? err.message : String(err)}`);
      setLoading(false);
      return null;
    }
  }, [isWalletReady, retryAttempt]);

  // Check wallet status and perform initial connection
  useEffect(() => {
    const initializeAndConnect = async () => {
      try {
        console.log("Starting wallet and contract initialization...");
        
        // First, initialize contract service
        if (!contractService.isInitialized) {
          console.log("Initializing contract service...");
          await contractService.init();
          setIsContractInitialized(true);
        } else {
          setIsContractInitialized(true);
        }
        
        // Check if we're likely connected from previous session
        const storedWalletAddress = sessionStorage.getItem('walletAddress');
        const storedLoansLoaded = sessionStorage.getItem('loansLastLoaded');
        
        if (storedWalletAddress) {
          console.log("Found stored wallet connection, attempting to reconnect...");
          setIsWalletConnected(true);
          
          // Pre-connect using cached information
          if (window.ethereum) {
            try {
              // Check real wallet status
              const accounts = await window.ethereum.request({ method: 'eth_accounts' });
              
              if (accounts && accounts.length > 0) {
                console.log("Wallet confirmed connected:", accounts[0]);
                
                // Reconnect wallet to contract
                await contractService.connectWallet();
                setIsWalletReady(true);
                
                // Store the connection
                sessionStorage.setItem('walletAddress', accounts[0]);
              } else {
                console.log("Stored wallet not actually connected, resetting state");
                sessionStorage.removeItem('walletAddress');
                sessionStorage.removeItem('loansLastLoaded');
                setIsWalletConnected(false);
              }
            } catch (err) {
              console.error("Error checking wallet connection:", err);
              setIsWalletConnected(false);
            }
          }
        } else {
          console.log("No stored wallet connection found");
        }
      } catch (err) {
        console.error("Initialization error:", err);
      } finally {
        // Always mark initial setup as complete
        setInitialLoadComplete(true);
      }
    };
    
    initializeAndConnect();
    
    // Set up wallet connection listeners
    if (window.ethereum) {
      const handleAccountsChanged = async (accounts: string[]) => {
        console.log("Accounts changed:", accounts);
        const connected = accounts && accounts.length > 0;
        setIsWalletConnected(connected);
        
        if (connected) {
          console.log("New wallet connected:", accounts[0]);
          sessionStorage.setItem('walletAddress', accounts[0]);
          
          try {
            await contractService.connectWallet();
            setIsWalletReady(true);
            loadLoans();
          } catch (err) {
            console.error("Failed to connect new wallet:", err);
          }
        } else {
          console.log("Wallet disconnected");
          sessionStorage.removeItem('walletAddress');
          sessionStorage.removeItem('loansLastLoaded');
          setIsWalletReady(false);
          setLoans([]);
        }
      };
      
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      
      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      };
    }
  }, [loadLoans]);

  // Once wallet is ready, load loans with retries
  useEffect(() => {
    if (isWalletReady) {
      console.log("Wallet ready, loading loans...");
      
      const loadWithRetry = async () => {
        const result = await loadLoans();
        
        // If no loans were loaded and we haven't maxed out retries, try again
        if ((!result || result.length === 0) && retryAttempt < 3) {
          const nextRetry = retryAttempt + 1;
          console.log(`No loans loaded, scheduling retry #${nextRetry} in ${Math.pow(2, nextRetry)}s`);
          
          setRetryAttempt(nextRetry);
          setTimeout(() => {
            console.log(`Executing retry attempt #${nextRetry}`);
            loadLoans(true); // Mark as a retry
          }, Math.pow(2, nextRetry) * 1000);
        }
      };
      
      loadWithRetry();
    }
  }, [isWalletReady, retryAttempt, loadLoans]);

  // Listen for loan creation events
  useEffect(() => {
    const handleLoanCreated = () => {
      console.log('Loan created event received, refreshing loans...');
      
      // Run multiple refresh attempts to ensure we catch the blockchain update
      loadLoans();
      
      // Try again after some delay
      setTimeout(() => loadLoans(true), 2000);
      setTimeout(() => loadLoans(true), 5000);
    };

    window.addEventListener(LOAN_CREATED_EVENT, handleLoanCreated);
    
    return () => {
      window.removeEventListener(LOAN_CREATED_EVENT, handleLoanCreated);
    };
  }, [loadLoans]);

  // Periodic refresh to catch any updates
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      if (isWalletReady && !loading) {
        // Only refresh if it's been more than 10 seconds since last refresh
        const now = Date.now();
        if (now - lastRefreshTime > 10000) {
          console.log('Periodic refresh of loans');
          loadLoans(true);
          setLastRefreshTime(now);
        }
      }
    }, 10000); // Check every 10 seconds
    
    return () => {
      clearInterval(refreshInterval);
    };
  }, [isWalletReady, loading, lastRefreshTime, loadLoans]);

// Enhanced loan repayment handler with proper TypeScript typing
const handleRepay = async (loanId: number) => {
  try {
    setProcessingLoanId(loanId);
    setRepayMethod('standard');
    setError(null);
    
    // Get loan details for better error messages
    const loanDetails = loans.find(loan => loan.id === loanId);
    
    await contractService.repayLoan(loanId);
    
    // Reload loans after repayment
    await loadLoans();
    
    // Display success message
    setSuccessMessage(`Loan for ${loanDetails?.tokenAmount || ''} ${loanDetails?.tokenName || 'tokens'} repaid successfully! Your collateral of ${loanDetails?.collateralAmount || ''} ETH has been returned.`);
    setTimeout(() => setSuccessMessage(null), 5000); // Clear after 5 seconds
    
    setProcessingLoanId(null);
    setRepayMethod(null);
  } catch (err) {
    console.error('Failed to repay loan:', err);
    
    let errorMessage = "";
    
    // Handle custom insufficient funds error with proper type checking
    if (err && 
        typeof err === 'object' && 
        'code' in err && 
        err.code === 'INSUFFICIENT_FUNDS') {
      
      // Type assertion to access details safely
      const errorObj = err as { 
        code: string; 
        details?: { 
          required?: string; 
          available?: string; 
          shortage?: string;
          tokenName?: string;
        } 
      };
      
      const details = errorObj.details || {};
      errorMessage = `Insufficient token balance. You need ${details.required || '?'} tokens but only have ${details.available || '?'} tokens. You are short by ${details.shortage || '?'} ${details.tokenName || 'tokens'}.`;
    } 
    // Handle standard errors
    else if (err instanceof Error) {
      errorMessage = err.message;
      
      // Clean up common blockchain error messages to be more user-friendly
      if (errorMessage.includes("execution reverted")) {
        errorMessage = "Transaction was rejected by the blockchain. Please try again.";
      } else if (errorMessage.includes("user rejected")) {
        errorMessage = "You cancelled the transaction. Please try again if you want to repay this loan.";
      }
    } 
    // Handle null errors
    else if (err === null) {
      errorMessage = "An unknown error occurred. Please try again.";
    } 
    // Handle object errors with null values
    else if (typeof err === 'object') {
      try {
        // Create typed object for clean error
        const cleanErr: Record<string, any> = {};
        for (const [key, value] of Object.entries(err as Record<string, any>)) {
          cleanErr[key] = value === null ? "Not available" : value;
        }
        errorMessage = JSON.stringify(cleanErr);
      } catch (jsonErr) {
        errorMessage = String(err);
      }
    } 
    else {
      errorMessage = String(err);
    }
    
    setError(`Failed to repay loan: ${errorMessage}`);
    setProcessingLoanId(null);
    setRepayMethod(null);
  }
};

  
  // Handle repay with collateral
  const handleRepayWithCollateral = async (loanId: number) => {
    try {
      setProcessingLoanId(loanId);
      setRepayMethod('collateral');
      setError(null);
      
      await contractService.repayWithCollateral(loanId);
      
      // Reload loans after repayment
      await loadLoans();
      
      setProcessingLoanId(null);
      setRepayMethod(null);
    } catch (err) {
      console.error('Failed to repay loan with collateral:', err);
      setError(`Failed to repay with collateral: ${err instanceof Error ? err.message : String(err)}`);
      setProcessingLoanId(null);
      setRepayMethod(null);
    }
  };

  // Manual refresh button handler
  const handleManualRefresh = () => {
    console.log("Manual refresh requested");
    setRetryAttempt(0); // Reset retry counter for manual refresh
    loadLoans();
  };

  // Show initial loading state
  if (!initialLoadComplete) {
    return <div className="user-loans loading">Initializing wallet connection...</div>;
  }

  // Show wallet connection prompt if not connected
  if (!isWalletConnected) {
    return (
      <div className="user-loans">
        <h2>Your Active Loans</h2>
        <div className="connect-wallet-message">
          <p>Please connect your wallet to view your loans.</p>
        </div>
      </div>
    );
  }

  // Show loading state while loans are being fetched
  if (loading) {
    return <div className="user-loans loading">Loading your loans...</div>;
  }

  // Main component render with loans or no-loans message
  return (
    <div className="user-loans">
      <div className="loans-header">
        <h2>Your Active Loans</h2>
        <button 
          className="refresh-button" 
          onClick={handleManualRefresh}
          title="Refresh loans"
        >
          🔄 Refresh
        </button>
      </div>
      
      {error && (
        <div className="error-message">{error}</div>
      )}
      
      {successMessage && (
        <div className="success-message">
          {successMessage}
        </div>
      )}

      {loans.length === 0 ? (
        <div className="no-loans-message">
          <p>You don't have any active loans.</p>
          <button className="retry-button" onClick={handleManualRefresh}>
            Check Again
          </button>
        </div>
      ) : (
        <div className="loans-list">
          {loans.map((loan) => (
            <div key={loan.id} className="loan-card">
              <div className="loan-header">
                <h3>{loan.tokenName}</h3>
                <span className={`status ${loan.timeRemaining === 'Expired' ? 'expired' : ''}`}>
                  {loan.timeRemaining === 'Expired' ? 'Past Due' : loan.timeRemaining + ' remaining'}
                </span>
              </div>
              
              <div className="loan-details">
                <div className="detail-row">
                  <span>Borrowed Amount:</span>
                  <span>{loan.tokenAmount} tokens</span>
                </div>
                <div className="detail-row">
                  <span>Collateral:</span>
                  <span>{loan.collateralAmount} ETH</span>
                </div>
                <div className="detail-row">
                  <span>Interest Accrued:</span>
                  <span>{loan.interestAccrued} tokens</span>
                </div>
                <div className="detail-row">
                  <span>Deadline:</span>
                  <span>{loan.deadlineDate}</span>
                </div>
              </div>
              
              <div className="loan-actions">
                <button
                  className="primary-button"
                  onClick={() => handleRepay(loan.id)}
                  disabled={processingLoanId === loan.id}
                >
                  {processingLoanId === loan.id && repayMethod === 'standard' ? 'Processing...' : 'Repay Loan'}
                </button>
                
                <button
                  className="secondary-button"
                  onClick={() => handleRepayWithCollateral(loan.id)}
                  disabled={processingLoanId === loan.id}
                >
                  {processingLoanId === loan.id && repayMethod === 'collateral' ? 'Processing...' : 'Repay with Collateral'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserLoans;
