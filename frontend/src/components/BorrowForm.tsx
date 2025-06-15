import { useState, useEffect, useCallback } from 'react';
import contractService, { 
  TokenInfo, 
  BorrowingTerms, 
  RateComparison,
  UserMLInsights 
} from '../services/ContractService';
import mlService, { 
  ChronotypePrediction 
} from '../services/MLService';
import './BorrowForm.css';

interface BorrowFormProps {
  selectedTokenType: number | null;
  onSuccess?: () => void;
}

// Custom event for loan creation
export const LOAN_CREATED_EVENT = 'loanCreated';

interface EnhancedBorrowState {
  useMLPrediction: boolean;
  activityPattern: number[] | null;
  borrowingTerms: BorrowingTerms | null;
  rateComparison: RateComparison | null;
  userInsights: UserMLInsights | null;
  mlPrediction: ChronotypePrediction | null;
  optimalTimes: number[] | null;
  showAdvancedOptions: boolean;
  currentHour: number;
  isLoadingML: boolean;
  mlError: string | null;
}

const BorrowForm = ({ selectedTokenType, onSuccess }: BorrowFormProps) => {
  const [token, setToken] = useState<TokenInfo | null>(null);
  const [tokenAmount, setTokenAmount] = useState<string>('1');
  const [collateralAmount, setCollateralAmount] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [isWalletConnected, setIsWalletConnected] = useState<boolean>(false);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [isLoadingToken, setIsLoadingToken] = useState<boolean>(false);
  
  // Enhanced ML state
  const [enhancedState, setEnhancedState] = useState<EnhancedBorrowState>({
    useMLPrediction: false,
    activityPattern: null,
    borrowingTerms: null,
    rateComparison: null,
    userInsights: null,
    mlPrediction: null,
    optimalTimes: null,
    showAdvancedOptions: false,
    currentHour: new Date().getHours(),
    isLoadingML: false,
    mlError: null
  });

  // Check wallet connection status
  useEffect(() => {
    const checkWalletConnection = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          const connected = accounts && accounts.length > 0;
          setIsWalletConnected(connected);
          
          if (connected && contractService.signer) {
            try {
              const address = await contractService.signer.getAddress();
              setUserAddress(address);
              console.log('BorrowForm connected to user:', address);
            } catch (err) {
              console.warn('Could not get user address:', err);
            }
          }
        } catch (err) {
          console.error('Failed to check wallet connection:', err);
          setIsWalletConnected(false);
        }
      }
    };

    checkWalletConnection();
    
    // Listen for account changes
    if (window.ethereum) {
      const handleAccountsChanged = async (accounts: string[]) => {
        const connected = accounts && accounts.length > 0;
        setIsWalletConnected(connected);
        
        if (connected) {
          try {
            await contractService.connectWallet();
            const address = await contractService.signer!.getAddress();
            setUserAddress(address);
          } catch (err) {
            console.error('Failed to reconnect wallet:', err);
            setUserAddress(null);
          }
        } else {
          setUserAddress(null);
        }
      };
      
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      
      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      };
    }
  }, []);

  // Load enhanced ML and contract data
  const loadEnhancedData = useCallback(async (
    selectedToken: TokenInfo, 
    amount: string, 
    address: string
  ) => {
    try {
      console.log('Loading enhanced data for:', { token: selectedToken.name, amount, address });
      
      // Load user insights and borrowing terms
      const [userInsights, borrowingTerms, rateComparison] = await Promise.all([
        contractService.getUserMLCircadianInsights(address).catch(() => null),
        contractService.previewBorrowingTerms(address, selectedToken.type, amount).catch(() => null),
        contractService.compareRateCalculations(address, selectedToken.type, amount).catch(() => null)
      ]);

      console.log('Contract data loaded:', { userInsights, borrowingTerms, rateComparison });

      // Generate sample activity pattern and get ML prediction
      let mlPrediction: ChronotypePrediction | null = null;
      let optimalTimes: number[] | null = null;
      
      try {
        // Generate activity pattern based on user insights if available
        const patternType = userInsights?.ml_chronotype === 0 ? 'early' : 
                           userInsights?.ml_chronotype === 2 ? 'late' : 'intermediate';
        
        const samplePattern = mlService.generateSampleActivityPattern(patternType);
        console.log('Generated sample pattern:', samplePattern);
        
        mlPrediction = await mlService.predictChronotype(samplePattern.values, false);
        console.log('ML prediction result:', mlPrediction);
        
        // Get optimal times from contract if available
        const optimalData = await contractService.getOptimalBorrowingTimes(address);
        optimalTimes = optimalData.optimal_hours;
        console.log('Optimal times loaded:', optimalTimes);
      } catch (err) {
        console.warn('Could not load ML data:', err);
        setEnhancedState(prev => ({ 
          ...prev, 
          mlError: 'ML prediction unavailable. Using standard rates.' 
        }));
      }

      // Update enhanced state
      setEnhancedState(prev => ({
        ...prev,
        borrowingTerms,
        rateComparison,
        userInsights,
        mlPrediction,
        optimalTimes
      }));

      // Set collateral amount
      if (borrowingTerms) {
        setCollateralAmount(parseFloat(borrowingTerms.required_collateral).toFixed(4));
      } else {
        // Fallback to static calculation
        const amount_num = parseFloat(amount) || 1;
        const collateral = (parseFloat(selectedToken.value) * amount_num * 1.5).toFixed(4);
        setCollateralAmount(collateral);
      }

    } catch (err) {
      console.error('Failed to load enhanced data:', err);
      
      // Fallback to basic calculation
      const amount_num = parseFloat(amount) || 1;
      const collateral = (parseFloat(selectedToken.value) * amount_num * 1.5).toFixed(4);
      setCollateralAmount(collateral);
      
      setEnhancedState(prev => ({ 
        ...prev, 
        mlError: 'Enhanced features unavailable. Using standard rates.'
      }));
    }
  }, []);

  // Load token details and enhanced data when selected token changes
  useEffect(() => {
    const loadToken = async () => {
      if (selectedTokenType === null) return;
      
      setIsLoadingToken(true);
      setError(null);
      
      try {
        const tokens = await contractService.getTokenDetails();
        const selectedToken = tokens.find(t => t.type === selectedTokenType);
        
        if (selectedToken) {
          setToken(selectedToken);
          setTokenAmount('1');
          
          // Load enhanced data if user is connected
          if (userAddress) {
            await loadEnhancedData(selectedToken, '1', userAddress);
          } else {
            // Calculate static collateral for non-connected users
            const collateral = (parseFloat(selectedToken.value) * 1.5).toFixed(4);
            setCollateralAmount(collateral);
          }
        } else {
          setError('Selected token not found');
        }
      } catch (err) {
        console.error('Failed to load token details:', err);
        setError(`Error loading token details: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setIsLoadingToken(false);
      }
    };

    loadToken();
  }, [selectedTokenType, userAddress, loadEnhancedData]);

  // Update collateral when token amount changes
  useEffect(() => {
    if (!token) return;
    
    const updateCollateral = async () => {
      if (userAddress) {
        // Use enhanced calculation
        await loadEnhancedData(token, tokenAmount, userAddress);
      } else {
        // Use static calculation
        try {
          const amount = parseFloat(tokenAmount) || 0;
          const tokenValue = parseFloat(token.value);
          const collateral = (tokenValue * amount * 1.5).toFixed(4);
          setCollateralAmount(collateral);
        } catch (err) {
          console.error('Calculation error:', err);
        }
      }
    };

    // Debounce the update
    const timeoutId = setTimeout(updateCollateral, 500);
    return () => clearTimeout(timeoutId);
  }, [tokenAmount, token, userAddress, loadEnhancedData]);

  const handleTokenAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow empty string or valid numbers
    if (value === '' || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0)) {
      setTokenAmount(value);
    }
  };

  const handleMLToggle = (enabled: boolean) => {
    setEnhancedState(prev => ({ ...prev, useMLPrediction: enabled }));
    
    if (enabled && !enhancedState.activityPattern) {
      // Generate default activity pattern
      try {
        const pattern = mlService.generateSampleActivityPattern('intermediate');
        setEnhancedState(prev => ({ ...prev, activityPattern: pattern.values }));
      } catch (err) {
        console.error('Failed to generate activity pattern:', err);
        setEnhancedState(prev => ({ 
          ...prev, 
          mlError: 'Failed to generate activity pattern'
        }));
      }
    }
  };

  const handleActivityPatternChange = async (pattern: number[]) => {
    setEnhancedState(prev => ({ ...prev, activityPattern: pattern, isLoadingML: true }));
    
    // Get new ML prediction
    try {
      const prediction = await mlService.predictChronotype(pattern, false);
      setEnhancedState(prev => ({ 
        ...prev, 
        mlPrediction: prediction,
        isLoadingML: false
      }));
    } catch (err) {
      console.warn('Could not update ML prediction:', err);
      setEnhancedState(prev => ({ 
        ...prev, 
        isLoadingML: false,
        mlError: 'Failed to update ML prediction'
      }));
    }
  };

  const generateSamplePattern = async (type: 'early' | 'intermediate' | 'late') => {
    setEnhancedState(prev => ({ ...prev, isLoadingML: true, mlError: null }));
    
    try {
      const pattern = mlService.generateSampleActivityPattern(type);
      console.log(`Generated ${type} pattern:`, pattern);
      await handleActivityPatternChange(pattern.values);
    } catch (err) {
      console.error('Failed to generate sample pattern:', err);
      setEnhancedState(prev => ({ 
        ...prev, 
        isLoadingML: false,
        mlError: 'Failed to generate sample pattern'
      }));
    }
  };

  const ensureWalletConnected = async (): Promise<boolean> => {
    if (!window.ethereum) {
      setError("MetaMask is not installed. Please install MetaMask to continue.");
      return false;
    }

    try {
      await contractService.connectWallet();
      const address = await contractService.signer!.getAddress();
      setUserAddress(address);
      setIsWalletConnected(true);
      return true;
    } catch (err) {
      console.error("Failed to connect wallet:", err);
      setError(`Wallet connection failed: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  };

  const handleBorrow = async () => {
    if (!token || !tokenAmount || !collateralAmount) {
      setError('Please fill in all required fields');
      return;
    }
    
    // Basic validation - be more lenient
    const tokenAmountNum = parseFloat(tokenAmount);
    const collateralAmountNum = parseFloat(collateralAmount);
    
    if (isNaN(tokenAmountNum) || tokenAmountNum <= 0) {
      setError('Please enter a valid token amount');
      return;
    }
    
    if (isNaN(collateralAmountNum) || collateralAmountNum <= 0) {
      setError('Invalid collateral amount calculated');
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    
    try {
      const connected = await ensureWalletConnected();
      if (!connected) {
        setIsProcessing(false);
        return;
      }
      
      let transactionResult;
      
      // Use ML-enhanced borrowing if enabled and activity pattern is available
      if (enhancedState.useMLPrediction && 
          enhancedState.activityPattern && 
          enhancedState.activityPattern.length === 24) {
        
        console.log('Using ML-enhanced borrowing with pattern:', enhancedState.activityPattern);
        transactionResult = await contractService.borrowTokensWithML(
          token.type,
          tokenAmount,
          collateralAmount,
          enhancedState.activityPattern
        );
      } else {
        // Use standard borrowing
        console.log('Using standard borrowing');
        transactionResult = await contractService.borrowTokens(
          token.type,
          tokenAmount,
          collateralAmount
        );
      }
      
      // Dispatch custom event
      window.dispatchEvent(new CustomEvent(LOAN_CREATED_EVENT, { 
        detail: { 
          tokenType: token.type,
          amount: tokenAmount,
          collateral: collateralAmount,
          mlEnhanced: enhancedState.useMLPrediction,
          transactionHash: transactionResult?.hash
        } 
      }));
      
      setSuccess(true);
      setIsProcessing(false);
      
      if (onSuccess) {
        onSuccess();
      }
      
    } catch (err) {
      console.error('Borrowing failed:', err);
      
      let errorMessage = `Transaction failed: ${err instanceof Error ? err.message : String(err)}`;
      
      // Enhanced error handling
      if (errorMessage.includes('Contract not initialized')) {
        errorMessage = "Wallet connection issue. Please try disconnecting and reconnecting your wallet.";
      } else if (errorMessage.includes('insufficient funds')) {
        errorMessage = "Insufficient ETH to cover collateral and gas fees.";
      } else if (errorMessage.includes('Insufficient collateral')) {
        errorMessage = "Insufficient collateral provided. Please increase your ETH amount.";
      } else if (errorMessage.includes('user rejected')) {
        errorMessage = "Transaction was cancelled by user.";
      } else if (errorMessage.includes('gas')) {
        errorMessage = "Transaction failed due to gas issues. Please try again.";
      }
      
      setError(errorMessage);
      setIsProcessing(false);
    }
  };

  const isOptimalTime = (): boolean => {
    if (!enhancedState.optimalTimes) return false;
    return enhancedState.optimalTimes.includes(enhancedState.currentHour);
  };

  const getTimingRecommendation = (): string => {
    if (!enhancedState.mlPrediction || !enhancedState.optimalTimes) return '';
    
    if (isOptimalTime()) {
      return `🌟 Optimal time! You're borrowing during one of your best hours (${enhancedState.currentHour}:00).`;
    } else {
      const nextOptimal = enhancedState.optimalTimes.find(hour => hour > enhancedState.currentHour) || 
                         enhancedState.optimalTimes[0];
      return `💡 Consider borrowing at ${nextOptimal}:00 for better rates based on your ${enhancedState.mlPrediction.chronotype_name} chronotype.`;
    }
  };

  // ✅ FIXED: Proper confidence display
  const formatConfidence = (confidence: number): string => {
    // Convert 1000-scale to percentage
    const percentage = Math.round(confidence / 10);
    return `${percentage}%`;
  };

  if (isLoadingToken) {
    return (
      <div className="borrow-form loading">
        <div className="loading-spinner"></div>
        <p>Loading token information...</p>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="borrow-form error">
        <p>Please select a token to borrow.</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="borrow-form success">
        <h3>🎉 Transaction Successful!</h3>
        <p>You have successfully borrowed {tokenAmount} {token.name}.</p>
        <p>Your collateral of {collateralAmount} ETH has been locked.</p>
        {enhancedState.useMLPrediction && (
          <p className="ml-success">✨ ML-enhanced borrowing completed with optimized rates!</p>
        )}
        <button 
          className="primary-button"
          onClick={() => {
            setSuccess(false);
            setTokenAmount('1');
            setError(null);
          }}
        >
          Borrow More
        </button>
      </div>
    );
  }

  return (
    <div className="borrow-form">
      <h3>Borrow {token.name}</h3>
      
      {/* Basic Token Info */}
      <div className="form-group token-info">
        <div className="info-row">
          <label>Token Value: {token.value} ETH</label>
          <label>Base Interest Rate: {token.rate}%</label>
        </div>
      </div>

      {/* ML Enhancement Toggle */}
      {userAddress && (
        <div className="form-group ml-toggle">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={enhancedState.useMLPrediction}
              onChange={(e) => handleMLToggle(e.target.checked)}
              disabled={enhancedState.isLoadingML}
            />
            <span className="toggle-text">
              🧠 Enable ML-Enhanced Borrowing
              <small>Get personalized rates based on your activity patterns</small>
            </span>
          </label>
          {enhancedState.isLoadingML && (
            <div className="ml-loading">
              <span>🔄 Loading ML prediction...</span>
            </div>
          )}
        </div>
      )}

      {/* ML Error Display */}
      {enhancedState.mlError && (
        <div className="form-group ml-error">
          <div className="warning-message">
            ⚠️ {enhancedState.mlError}
          </div>
        </div>
      )}

      {/* Advanced Options */}
      {userAddress && (
        <div className="form-group">
          <button
            type="button"
            className="toggle-advanced"
            onClick={() => setEnhancedState(prev => ({ ...prev, showAdvancedOptions: !prev.showAdvancedOptions }))}
            disabled={enhancedState.isLoadingML}
          >
            {enhancedState.showAdvancedOptions ? '🔼' : '🔽'} Advanced Options
          </button>
        </div>
      )}

      {/* Advanced Options Panel */}
      {enhancedState.showAdvancedOptions && userAddress && (
        <div className="advanced-options">
          {/* Activity Pattern Input */}
          {enhancedState.useMLPrediction && (
            <div className="form-group">
              <label>Activity Pattern (for ML prediction):</label>
              <div className="pattern-selector">
                <button
                  type="button"
                  className="pattern-button early"
                  onClick={() => generateSamplePattern('early')}
                  disabled={enhancedState.isLoadingML}
                >
                  🌅 Early Bird Pattern
                </button>
                <button
                  type="button"
                  className="pattern-button intermediate"
                  onClick={() => generateSamplePattern('intermediate')}
                  disabled={enhancedState.isLoadingML}
                >
                  ☀️ Balanced Pattern
                </button>
                <button
                  type="button"
                  className="pattern-button late"
                  onClick={() => generateSamplePattern('late')}
                  disabled={enhancedState.isLoadingML}
                >
                  🌙 Night Owl Pattern
                </button>
              </div>
              {enhancedState.activityPattern && (
                <div className="pattern-preview">
                  <small>✅ Activity pattern loaded ({enhancedState.activityPattern.length} hours)</small>
                </div>
              )}
            </div>
          )}

          {/* Timing Recommendation */}
          {enhancedState.mlPrediction && !enhancedState.isLoadingML && (
            <div className="form-group timing-rec">
              <div className={`timing-indicator ${isOptimalTime() ? 'optimal' : 'suboptimal'}`}>
                {getTimingRecommendation()}
              </div>
            </div>
          )}

          {/* Rate Comparison */}
          {enhancedState.rateComparison && (
            <div className="form-group rate-comparison">
              <h4>📊 Rate Comparison</h4>
              <div className="rate-grid">
                <div className="rate-item traditional">
                  <span>Traditional Rate:</span>
                  <span>{(parseFloat(enhancedState.rateComparison.traditional_rate) * 100).toFixed(3)}%</span>
                </div>
                <div className="rate-item ml-enhanced">
                  <span>ML-Enhanced Rate:</span>
                  <span>{(parseFloat(enhancedState.rateComparison.ml_enhanced_rate) * 100).toFixed(3)}%</span>
                </div>
                <div className={`rate-item savings ${enhancedState.rateComparison.ml_beneficial ? 'positive' : 'negative'}`}>
                  <span>Difference:</span>
                  <span>
                    {enhancedState.rateComparison.ml_beneficial ? '💰 ' : '⚠️ '}
                    {enhancedState.rateComparison.ml_beneficial ? '-' : '+'}
                    {(parseFloat(enhancedState.rateComparison.savings) * 100).toFixed(3)}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* User Insights */}
          {enhancedState.userInsights && enhancedState.userInsights.total_sessions > 0 && (
            <div className="form-group user-insights">
              <h4>👤 Your Profile</h4>
              <div className="insights-grid">
                <div className="insight-item">
                  <span>Sessions:</span>
                  <span>{enhancedState.userInsights.total_sessions.toString()}</span>
                </div>
                <div className="insight-item">
                  <span>Risk Score:</span>
                  <span className={`risk-score ${
                    enhancedState.userInsights.risk_score < 300 ? 'low' : 
                    enhancedState.userInsights.risk_score < 700 ? 'medium' : 'high'
                  }`}>
                    {enhancedState.userInsights.risk_score}/1000
                  </span>
                </div>
                <div className="insight-item">
                  <span>Consistency:</span>
                  <span>{enhancedState.userInsights.consistency_score}/1000</span>
                </div>
                <div className="insight-item">
                  <span>ML Confidence:</span>
                  <span>{formatConfidence(enhancedState.userInsights.ml_confidence)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Borrowing Amount */}
      <div className="form-group">
        <label htmlFor="tokenAmount">How many tokens would you like to borrow?</label>
        <input
          id="tokenAmount"
          type="number"
          min="0.1"
          max="1000"
          step="0.1"
          value={tokenAmount}
          onChange={handleTokenAmountChange}
          disabled={isProcessing || enhancedState.isLoadingML}
          placeholder="Enter amount (0.1 - 1000)"
        />
      </div>
      
      {/* Collateral Display */}
      <div className="form-group">
        <label htmlFor="collateralAmount">
          {userAddress ? 'Dynamic Collateral Required' : 'Required Collateral (150%)'}
        </label>
        <div className="collateral-display">
          <input
            id="collateralAmount"
            type="text"
            value={`${collateralAmount} ETH`}
            disabled
          />
          {enhancedState.borrowingTerms && userAddress && (
            <small className="collateral-note">
              {parseFloat(collateralAmount) < parseFloat(token.value) * parseFloat(tokenAmount) * 1.5 
                ? '💰 Reduced collateral due to your good profile!' 
                : parseFloat(collateralAmount) > parseFloat(token.value) * parseFloat(tokenAmount) * 1.5
                ? '⚠️ Higher collateral due to risk factors'
                : '📊 Standard collateral requirement'
              }
            </small>
          )}
        </div>
      </div>

      {/* Borrowing Terms Preview */}
      {enhancedState.borrowingTerms && userAddress && (
        <div className="form-group terms-preview">
          <h4>📋 Borrowing Terms Preview</h4>
          <div className="terms-grid">
            <div className="term-item">
              <span>Interest Rate:</span>
              <span>{(parseFloat(enhancedState.borrowingTerms.interest_rate) * 100).toFixed(3)}%</span>
            </div>
            <div className="term-item">
              <span>Risk Assessment:</span>
              <span>{enhancedState.borrowingTerms.risk_score}/1000</span>
            </div>
            <div className="term-item">
              <span>Loan Duration:</span>
              <span>7 days</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Action Button */}
      {!isWalletConnected ? (
        <div className="wallet-warning">
          <p>🔗 Connect your wallet to access enhanced borrowing features</p>
          <button 
            className="secondary-button"
            onClick={ensureWalletConnected}
          >
            Connect Wallet
          </button>
        </div>
      ) : (
        <button 
          className={`primary-button ${enhancedState.useMLPrediction ? 'ml-enabled' : ''}`}
          onClick={handleBorrow}
          disabled={
            isProcessing || 
            enhancedState.isLoadingML || 
            !tokenAmount || 
            !collateralAmount ||
            parseFloat(tokenAmount) <= 0
          }
        >
          {isProcessing ? 'Processing Transaction...' : 
           enhancedState.isLoadingML ? 'Loading ML Data...' :
           enhancedState.useMLPrediction ? '🧠 Borrow with ML Enhancement' : 'Borrow Tokens'}
        </button>
      )}
      
      {/* Error Display */}
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {/* ML Status Indicator */}
      {enhancedState.useMLPrediction && enhancedState.mlPrediction && !enhancedState.isLoadingML && (
        <div className="ml-status">
          <small>
            🧬 ML Prediction: {enhancedState.mlPrediction.chronotype_name} chronotype 
            ({formatConfidence(enhancedState.mlPrediction.confidence)} confidence)
          </small>
        </div>
      )}
    </div>
  );
};

export default BorrowForm;
