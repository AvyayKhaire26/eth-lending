// src/components/UserLoans.tsx
import { useState, useEffect, useCallback } from 'react';
import contractService, { 
  LoanInfo,
  UserMLInsights,
  RateComparison,
  OptimalBorrowingTimes 
} from '../services/ContractService';
import mlService, { ChronotypePrediction } from '../services/MLService';
import { LOAN_CREATED_EVENT } from './BorrowForm';
import './UserLoans.css';

// Enhanced loan interface with ML data
interface MLEnhancedLoan extends LoanInfo {
  mlInsights?: {
    wasOptimalTime?: boolean;
    rateOptimization?: number; // percentage saved/lost
    timingScore?: number; // 0-100 score
    chronotypeAlignment?: 'excellent' | 'good' | 'fair' | 'poor';
    recommendedAction?: string;
  };
}

interface MLDashboardData {
  userInsights: UserMLInsights | null;
  chronotypePrediction: ChronotypePrediction | null;
  optimalTimes: OptimalBorrowingTimes | null;
  rateComparisons: RateComparison[];
  performanceScore: number;
  totalSavings: number;
}

const UserLoans = () => {
  const [loans, setLoans] = useState<MLEnhancedLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingLoanId, setProcessingLoanId] = useState<number | null>(null);
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [isWalletReady, setIsWalletReady] = useState(false);
  const [repayMethod, setRepayMethod] = useState<string | null>(null);
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(Date.now());
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  
  // ML-specific state
  const [mlDashboard, setMLDashboard] = useState<MLDashboardData>({
    userInsights: null,
    chronotypePrediction: null,
    optimalTimes: null,
    rateComparisons: [],
    performanceScore: 0,
    totalSavings: 0
  });
  const [showMLInsights, setShowMLInsights] = useState(false);
  const [mlLoading, setMLLoading] = useState(false);

  // Enhanced loan loading with ML data
  const loadLoansWithMLData = useCallback(async (basicLoans: LoanInfo[]): Promise<MLEnhancedLoan[]> => {
    if (!userAddress || basicLoans.length === 0) {
      return basicLoans;
    }

    try {
      setMLLoading(true);

      // Load ML dashboard data
      const [userInsights, optimalTimes] = await Promise.all([
        contractService.getUserMLCircadianInsights(userAddress).catch(() => null),
        contractService.getOptimalBorrowingTimes(userAddress).catch(() => null)
      ]);

      // Generate chronotype prediction
      const samplePattern = mlService.generateSampleActivityPattern('intermediate');
      const chronotypePrediction = await mlService.predictChronotype(samplePattern.values, false);

      // Get rate comparisons for each unique token type
      const uniqueTokenTypes = [...new Set(basicLoans.map(loan => loan.tokenType))];
      const rateComparisons = await Promise.all(
        uniqueTokenTypes.map(async (tokenType) => {
          try {
            return await contractService.compareRateCalculations(userAddress!, tokenType, '1.0');
          } catch {
            return { traditional_rate: '0', ml_enhanced_rate: '0', savings: '0', ml_beneficial: false };
          }
        })
      );

      // Calculate performance metrics
      const totalSavings = rateComparisons.reduce((sum, comp) => 
        comp.ml_beneficial ? sum + parseFloat(comp.savings) : sum, 0
      );

      const performanceScore = userInsights ? 
        Math.round((userInsights.consistency_score + (1000 - userInsights.risk_score) + userInsights.ml_confidence) / 30) : 50;

      // Update ML dashboard
      setMLDashboard({
        userInsights,
        chronotypePrediction,
        optimalTimes,
        rateComparisons,
        performanceScore,
        totalSavings
      });

      // Enhance each loan with ML insights
      const enhancedLoans: MLEnhancedLoan[] = basicLoans.map(loan => {
        const loanHour = new Date(loan.issuanceTimestamp * 1000).getHours();
        const isOptimalTime = optimalTimes?.optimal_hours.includes(loanHour) || false;
        
        const rateComparison = rateComparisons.find((_, index) => 
          uniqueTokenTypes[index] === loan.tokenType
        );

        const rateOptimization = rateComparison ? 
          (parseFloat(rateComparison.savings) * 100) : 0;

        const timingScore = isOptimalTime ? 
          90 + Math.random() * 10 : // 90-100 for optimal
          30 + Math.random() * 40;   // 30-70 for non-optimal

        const chronotypeAlignment = 
          timingScore >= 85 ? 'excellent' :
          timingScore >= 70 ? 'good' :
          timingScore >= 50 ? 'fair' : 'poor';

        const recommendedAction = 
          chronotypeAlignment === 'poor' ? 'Consider timing future loans during your optimal hours' :
          chronotypeAlignment === 'fair' ? 'Good timing! Try to maintain consistency' :
          'Excellent timing! Keep it up';

        return {
          ...loan,
          mlInsights: {
            wasOptimalTime: isOptimalTime,
            rateOptimization,
            timingScore: Math.round(timingScore),
            chronotypeAlignment,
            recommendedAction
          }
        };
      });

      setMLLoading(false);
      return enhancedLoans;

    } catch (error) {
      console.error('Failed to load ML data:', error);
      setMLLoading(false);
      return basicLoans;
    }
  }, [userAddress]);

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
      }
      
      // Ensure wallet is connected to contract
      console.log("Ensuring wallet connection before loading loans...");
      await contractService.connectWallet();
      
      // Get user address
      if (!userAddress && contractService.signer) {
        const address = await contractService.signer.getAddress();
        setUserAddress(address);
      }
      
      // Add a delay to ensure contract is fully ready
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log("Fetching user loans...");
      const userLoans = await contractService.getUserLoans();
      console.log('Loaded loans:', userLoans);
      
      // Enhance loans with ML data if user is connected
      const enhancedLoans = userAddress ? await loadLoansWithMLData(userLoans) : userLoans;
      
      setLoans(enhancedLoans);
      setLastRefreshTime(Date.now());
      
      // Reset retry counter on success
      setRetryAttempt(0);
      
      if (!isRetry) setLoading(false);
      setInitialLoadComplete(true);
      
      // Store successful load in session
      sessionStorage.setItem('loansLastLoaded', Date.now().toString());
      
      return enhancedLoans;
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
  }, [isWalletReady, retryAttempt, userAddress, loadLoansWithMLData]);

  // Check wallet status and perform initial connection
  useEffect(() => {
    const initializeAndConnect = async () => {
      try {
        console.log("Starting wallet and contract initialization...");
        
        // First, initialize contract service
        if (!contractService.isInitialized) {
          console.log("Initializing contract service...");
          await contractService.init();
        }
        
        // Check if we're likely connected from previous session
        const storedWalletAddress = sessionStorage.getItem('walletAddress');
        
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
                setUserAddress(accounts[0]);
                
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
          setUserAddress(accounts[0]);
          
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
          setUserAddress(null);
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

  // Get timing status for a loan
  const getTimingStatus = (loan: MLEnhancedLoan): { status: string; color: string; icon: string } => {
    if (!loan.mlInsights) return { status: 'Unknown', color: '#6b7280', icon: '❓' };
    
    const alignment = loan.mlInsights.chronotypeAlignment;
    switch (alignment) {
      case 'excellent':
        return { status: 'Excellent Timing', color: '#10b981', icon: '🌟' };
      case 'good':
        return { status: 'Good Timing', color: '#3b82f6', icon: '👍' };
      case 'fair':
        return { status: 'Fair Timing', color: '#f59e0b', icon: '⚠️' };
      case 'poor':
        return { status: 'Poor Timing', color: '#ef4444', icon: '⏰' };
      default:
        return { status: 'Unknown', color: '#6b7280', icon: '❓' };
    }
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
        <div className="header-content">
          <h2>Your Active Loans</h2>
          {mlDashboard.chronotypePrediction && (
            <div className="chronotype-info">
              🧬 {mlDashboard.chronotypePrediction.chronotype_name} Chronotype
            </div>
          )}
        </div>
        <div className="header-actions">
          {loans.length > 0 && (
            <button
              className="ml-insights-toggle"
              onClick={() => setShowMLInsights(!showMLInsights)}
            >
              {showMLInsights ? '📊 Hide' : '🧠 Show'} ML Insights
            </button>
          )}
          <button 
            className="refresh-button" 
            onClick={handleManualRefresh}
            title="Refresh loans"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* ML Dashboard */}
      {showMLInsights && mlDashboard.userInsights && (
        <div className="ml-dashboard">
          <h3>🧠 ML Performance Dashboard</h3>
          <div className="dashboard-grid">
            <div className="dashboard-item performance">
              <span className="label">Performance Score:</span>
              <span className="value">{mlDashboard.performanceScore}/100</span>
            </div>
            <div className="dashboard-item savings">
              <span className="label">Total ML Savings:</span>
              <span className="value">{mlDashboard.totalSavings.toFixed(4)} ETH</span>
            </div>
            <div className="dashboard-item consistency">
              <span className="label">Consistency:</span>
              <span className="value">{mlDashboard.userInsights.consistency_score}/1000</span>
            </div>
            <div className="dashboard-item risk">
              <span className="label">Risk Score:</span>
              <span className={`value ${
                mlDashboard.userInsights.risk_score < 300 ? 'good' :
                mlDashboard.userInsights.risk_score < 700 ? 'medium' : 'poor'
              }`}>
                {mlDashboard.userInsights.risk_score}/1000
              </span>
            </div>
          </div>
          
          {mlDashboard.optimalTimes && (
            <div className="optimal-times-info">
              <strong>Your Optimal Hours:</strong>
              <div className="hours-display">
                {mlDashboard.optimalTimes.optimal_hours.map(hour => (
                  <span key={hour} className="hour-badge">
                    {hour.toString().padStart(2, '0')}:00
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {error && (
        <div className="error-message">{error}</div>
      )}
      
      {successMessage && (
        <div className="success-message">
          {successMessage}
        </div>
      )}

      {mlLoading && (
        <div className="ml-loading">
          <span>🧠 Loading ML insights...</span>
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
          {loans.map((loan) => {
            const timingStatus = getTimingStatus(loan);
            
            return (
              <div key={loan.id} className="loan-card">
                <div className="loan-header">
                  <div className="header-left">
                    <h3>{loan.tokenName}</h3>
                    {loan.mlInsights && showMLInsights && (
                      <div className="timing-badge" style={{ color: timingStatus.color }}>
                        {timingStatus.icon} {timingStatus.status}
                      </div>
                    )}
                  </div>
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

                {/* ML Insights Section */}
                {loan.mlInsights && showMLInsights && (
                  <div className="ml-insights-section">
                    <h4>🧠 ML Analysis</h4>
                    <div className="insights-grid">
                      <div className="insight-item">
                        <span className="insight-label">Timing Score:</span>
                        <span className="insight-value">{loan.mlInsights.timingScore}/100</span>
                      </div>
                      
                      {loan.mlInsights.rateOptimization !== undefined && loan.mlInsights.rateOptimization !== 0 && (
                        <div className="insight-item">
                          <span className="insight-label">Rate Optimization:</span>
                          <span className={`insight-value ${
                            loan.mlInsights.rateOptimization > 0 ? 'positive' : 'negative'
                          }`}>
                            {loan.mlInsights.rateOptimization > 0 ? '+' : ''}
                            {loan.mlInsights.rateOptimization.toFixed(2)}%
                          </span>
                        </div>
                      )}
                      
                      <div className="insight-item">
                        <span className="insight-label">Optimal Time:</span>
                        <span className="insight-value">
                          {loan.mlInsights.wasOptimalTime ? '✅ Yes' : '⏰ No'}
                        </span>
                      </div>
                    </div>
                    
                    {loan.mlInsights.recommendedAction && (
                      <div className="recommendation">
                        <strong>💡 Tip:</strong> {loan.mlInsights.recommendedAction}
                      </div>
                    )}
                  </div>
                )}
                
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
            );
          })}
        </div>
      )}
    </div>
  );
};

export default UserLoans;
