import { useState, useEffect, useCallback } from 'react';
import contractService from '../services/ContractService';
import './CollateralStatistics.css';

const CollateralStatistics = () => {
  const [totalCollateral, setTotalCollateral] = useState<string>('0');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);
  const [initialized, setInitialized] = useState(false);

  // Memoized loading function to prevent recreation
  const loadCollateralData = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    
    try {
      console.log("Loading collateral data...");
      
      // Ensure contract service is initialized
      if (!contractService.isInitialized) {
        console.log("Initializing contract service...");
        await contractService.init();
      }
      
      // Connect wallet if available to ensure fresh state
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts && accounts.length > 0) {
            console.log("Reconnecting wallet...");
            await contractService.connectWallet();
          }
        } catch (err) {
          console.warn("Wallet connection check failed:", err);
        }
      }
      
      // Allow time for contract state to settle
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Track how long this takes for debugging
      const startTime = Date.now();
      const collateral = await contractService.getTotalCollateral();
      const endTime = Date.now();
      console.log(`Retrieved total collateral: ${collateral} ETH (took ${endTime - startTime}ms)`);
      
      setTotalCollateral(collateral);
      setLastUpdateTime(Date.now());
      setRetryCount(0);
      
      if (!silent) {
        setLoading(false);
      }
      
      // Store successful state in sessionStorage for persistence
      sessionStorage.setItem('lastCollateralAmount', collateral);
      sessionStorage.setItem('lastCollateralUpdateTime', Date.now().toString());
      
      setInitialized(true);
      return true;
    } catch (err) {
      console.error('Failed to load collateral data:', err);
      
      // Try to restore from session storage on error
      const storedAmount = sessionStorage.getItem('lastCollateralAmount');
      if (storedAmount && !initialized) {
        console.log("Restoring collateral amount from session storage:", storedAmount);
        setTotalCollateral(storedAmount);
        setInitialized(true);
      }
      
      if (!silent) {
        setError(`Failed to load collateral data: ${err instanceof Error ? err.message : String(err)}`);
        setLoading(false);
      }
      
      return false;
    }
  }, [initialized]);

  // Initial loading with retry mechanism
  useEffect(() => {
    // Try to restore from session storage first for immediate display
    const storedAmount = sessionStorage.getItem('lastCollateralAmount');
    const storedTime = sessionStorage.getItem('lastCollateralUpdateTime');
    
    if (storedAmount && storedTime) {
      const ageInMinutes = (Date.now() - parseInt(storedTime)) / (1000 * 60);
      console.log(`Found stored collateral data (${ageInMinutes.toFixed(1)} minutes old)`);
      
      // Use stored data if less than 5 minutes old
      if (ageInMinutes < 5) {
        setTotalCollateral(storedAmount);
        setInitialized(true);
        setLoading(false);
      }
    }
    
    // Load fresh data with retry logic
    const attemptLoadWithRetry = async () => {
      const success = await loadCollateralData();
      
      if (!success && retryCount < 3) {
        console.log(`Load failed, scheduling retry #${retryCount + 1}`);
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
        }, Math.pow(2, retryCount) * 1000); // Exponential backoff
      }
    };
    
    attemptLoadWithRetry();
    
    // Set up periodic refresh
    const refreshInterval = setInterval(() => {
      // Silent refresh every minute
      loadCollateralData(true);
    }, 60000);
    
    return () => clearInterval(refreshInterval);
  }, [loadCollateralData, retryCount]);

  // Listen for blockchain events
  useEffect(() => {
    // Set up an event listener for new blocks (if available)
    if (contractService.provider) {
      try {
        contractService.provider.on('block', (blockNumber) => {
          console.log(`New block: ${blockNumber}, checking for updates...`);
          
          // Only do a silent refresh if initialized and not currently loading
          if (initialized && !loading) {
            // Throttle updates to avoid too many refreshes
            const now = Date.now();
            if (now - lastUpdateTime > 15000) { // No more than once every 15 seconds
              loadCollateralData(true);
            }
          }
        });
        
        return () => {
          contractService.provider?.removeAllListeners('block');
        };
      } catch (err) {
        console.log("Failed to set up block listener:", err);
      }
    }
  }, [initialized, loading, lastUpdateTime, loadCollateralData]);

  // Handle manual refresh
  const handleManualRefresh = () => {
    setRetryCount(0);
    loadCollateralData();
  };

  return (
    <div className="collateral-statistics">
      <div className="collateral-header">
        <h2>Protocol Collateral</h2>
        <button 
          className="refresh-button" 
          onClick={handleManualRefresh} 
          title="Refresh data"
        >
          🔄 Refresh
        </button>
      </div>
      
      {loading && !initialized ? (
        <div className="loading">Loading collateral data...</div>
      ) : error ? (
        <div className="error-message">
          {error}
          <button 
            className="retry-button" 
            onClick={handleManualRefresh}
          >
            Try Again
          </button>
        </div>
      ) : (
        <div className="collateral-content">
          <div className="collateral-card">
            <h3>Total Locked Collateral</h3>
            <div className="collateral-value">{totalCollateral} ETH</div>
            <div className="collateral-subtitle">Value locked in protocol</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollateralStatistics;
