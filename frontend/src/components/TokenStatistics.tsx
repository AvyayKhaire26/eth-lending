/**
 * TokenStatistics.tsx
 * Enhanced protocol statistics with ML-powered circadian rate information
 * Fixed version with proper error handling and performance optimization
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import contractService, { 
  TokenStatistics as TokenStatsType,
  RateComparison,
  OptimalBorrowingTimes 
} from '../services/ContractService';
import mlService, { ChronotypePrediction } from '../services/MLService';
import './TokenStatistics.css';

// ==================== INTERFACES ====================

interface MLEnhancedStats extends TokenStatsType {
  rateComparison?: RateComparison;
  circadianMultiplier?: number;
  optimalHours?: number[];
  currentHourMultiplier?: number;
  mlBeneficial?: boolean;
  isLoading?: boolean;
  error?: string;
}

interface CircadianInfo {
  currentHour: number;
  isOptimalTime: boolean;
  nextOptimalHour?: number;
  chronotypePrediction?: ChronotypePrediction;
  timeStatus: {
    status: string;
    color: string;
    icon: string;
  };
}

interface ComponentState {
  stats: MLEnhancedStats[];
  loading: boolean;
  error: string | null;
  userAddress: string | null;
  showMLFeatures: boolean;
  optimalTimes: OptimalBorrowingTimes | null;
  lastUpdate: number;
  isRefreshing: boolean;
}

// ==================== MAIN COMPONENT ====================

const TokenStatistics = () => {
  const [state, setState] = useState<ComponentState>({
    stats: [],
    loading: true,
    error: null,
    userAddress: null,
    showMLFeatures: false,
    optimalTimes: null,
    lastUpdate: 0,
    isRefreshing: false
  });

  const [circadianInfo, setCircadianInfo] = useState<CircadianInfo>({
    currentHour: new Date().getHours(),
    isOptimalTime: false,
    timeStatus: { status: 'Loading...', color: '#6b7280', icon: '⏳' }
  });

  // Refs for cleanup and preventing memory leaks
  const mountedRef = useRef(true);
  const timeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (timeIntervalRef.current) {
        clearInterval(timeIntervalRef.current);
      }
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // ==================== HELPER FUNCTIONS ====================

  const updateState = useCallback((updates: Partial<ComponentState>) => {
    if (!mountedRef.current) return;
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const updateCircadianInfo = useCallback((updates: Partial<CircadianInfo>) => {
    if (!mountedRef.current) return;
    setCircadianInfo(prev => ({ ...prev, ...updates }));
  }, []);

  const getCurrentTimeStatus = useCallback((hour: number, isOptimal: boolean): { status: string; color: string; icon: string } => {
    if (isOptimal) {
      return { status: 'Optimal Time', color: '#10b981', icon: '🌟' };
    }
    
    if (hour >= 6 && hour <= 10) {
      return { status: 'Morning Peak', color: '#f59e0b', icon: '🌅' };
    }
    
    if (hour >= 11 && hour <= 17) {
      return { status: 'Day Active', color: '#3b82f6', icon: '☀️' };
    }
    
    if (hour >= 18 && hour <= 22) {
      return { status: 'Evening', color: '#8b5cf6', icon: '🌆' };
    }
    
    return { status: 'Night Time', color: '#6b7280', icon: '🌙' };
  }, []);

  const getUtilizationColor = useCallback((rate: number): string => {
    if (rate < 30) return '#10b981'; // Green
    if (rate < 70) return '#f59e0b'; // Amber
    return '#ef4444'; // Red
  }, []);

  const getMultiplierColor = useCallback((multiplier: number): string => {
    if (multiplier < 10000) return '#10b981'; // Green (beneficial)
    if (multiplier > 10000) return '#ef4444'; // Red (penalty)
    return '#6b7280'; // Gray (neutral)
  }, []);

  const formatMultiplier = useCallback((multiplier: number): string => {
    const percentage = ((multiplier - 10000) / 100);
    return `${percentage > 0 ? '+' : ''}${percentage.toFixed(1)}%`;
  }, []);

  // ✅ FIXED: Proper confidence display
  const formatConfidence = useCallback((confidence: number): string => {
    // Convert from 1000-scale to percentage
    const percentage = Math.round(confidence / 10);
    return `${percentage}%`;
  }, []);

  // ==================== DATA LOADING FUNCTIONS ====================

  // Get user address if wallet is connected
  const getUserAddress = useCallback(async () => {
    try {
      if (contractService.signer) {
        const address = await contractService.signer.getAddress();
        if (!mountedRef.current) return;
        
        console.log('TokenStatistics connected to user:', address);
        updateState({ 
          userAddress: address, 
          showMLFeatures: true 
        });
        return address;
      }
    } catch (err) {
      console.warn('Could not get user address:', err);
      if (mountedRef.current) {
        updateState({ userAddress: null, showMLFeatures: false });
      }
    }
    return null;
  }, [updateState]);

  // Load basic token statistics
  const loadTokenStats = useCallback(async (isRefresh = false) => {
    if (!mountedRef.current) return;
    
    // Create new abort controller
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    try {
      if (!isRefresh) {
        updateState({ loading: true, error: null });
      } else {
        updateState({ isRefreshing: true, error: null });
      }
      
      console.log('Loading token statistics...');
      const tokenStats = await contractService.getTokenStatistics();
      
      if (!mountedRef.current) return;
      
      // Initialize with basic stats
      const initialStats: MLEnhancedStats[] = tokenStats.map(stat => ({
        ...stat,
        isLoading: false
      }));
      
      updateState({ 
        stats: initialStats,
        loading: false,
        isRefreshing: false,
        lastUpdate: Date.now()
      });
      
      console.log('Token statistics loaded successfully');
      
    } catch (err) {
      console.error('Failed to load token statistics:', err);
      
      if (!mountedRef.current) return;
      
      const errorMessage = `Failed to load token statistics: ${err instanceof Error ? err.message : String(err)}`;
      updateState({ 
        error: errorMessage,
        loading: false,
        isRefreshing: false
      });
    }
  }, [updateState]);

  // Load ML-enhanced data
  const loadMLEnhancedData = useCallback(async (userAddress: string, currentStats: MLEnhancedStats[]) => {
    if (!mountedRef.current || currentStats.length === 0) return;

    try {
      console.log('Loading ML-enhanced data for user:', userAddress);
      
      // Mark stats as loading ML data
      const loadingStats = currentStats.map(stat => ({ ...stat, isLoading: true }));
      updateState({ stats: loadingStats });

      // Get optimal borrowing times and chronotype prediction in parallel
      const [optimalData, samplePattern] = await Promise.all([
        contractService.getOptimalBorrowingTimes(userAddress).catch(() => null),
        Promise.resolve(mlService.generateSampleActivityPattern('intermediate'))
      ]);

      if (!mountedRef.current) return;

      // Get ML prediction if pattern is valid
      let chronotypePrediction: ChronotypePrediction | null = null;
      if (mlService.validateActivityPattern(samplePattern.values)) {
        try {
          chronotypePrediction = await mlService.predictChronotype(samplePattern.values, false);
          console.log('Chronotype prediction:', chronotypePrediction);
        } catch (err) {
          console.warn('Could not get chronotype prediction:', err);
        }
      }

      if (!mountedRef.current) return;

      // Update circadian info
      const currentHour = new Date().getHours();
      const isOptimalTime = optimalData ? optimalData.optimal_hours.includes(currentHour) : false;
      const nextOptimalHour = optimalData ? 
        optimalData.optimal_hours.find(hour => hour > currentHour) || optimalData.optimal_hours[0] : 
        undefined;

      updateCircadianInfo({
        currentHour,
        isOptimalTime,
        nextOptimalHour,
        chronotypePrediction: chronotypePrediction || undefined,
        timeStatus: getCurrentTimeStatus(currentHour, isOptimalTime)
      });

      updateState({ optimalTimes: optimalData });

      // Enhance each token's statistics with ML data
      const enhancedStats = await Promise.all(
        currentStats.map(async (stat) => {
          if (!mountedRef.current) return stat;
          
          try {
            console.log(`Loading ML data for ${stat.tokenName}...`);
            
            // Get rate comparison for this token
            const rateComparison = await contractService.compareRateCalculations(
              userAddress,
              stat.tokenType,
              '1.0' // Standard 1 token for comparison
            );

            // Calculate circadian multiplier based on chronotype and current hour
            const baseMultiplier = 10000; // 100%
            const chronotypeMultipliers = [9500, 10000, 11000]; // Early, Intermediate, Late
            const chronotypeMultiplier = chronotypePrediction?.success 
              ? chronotypeMultipliers[chronotypePrediction.chronotype] || 10000
              : 10000;
            
            // Time-based multiplier (more sophisticated)
            const hourMultipliers: Record<number, number> = {
              0: 11200, 1: 11500, 2: 11200, 3: 11000, 4: 10500, 5: 10000,
              6: 9500, 7: 9200, 8: 9000, 9: 9500, 10: 10000, 11: 10200,
              12: 10500, 13: 10800, 14: 10500, 15: 10200, 16: 10000, 17: 9800,
              18: 9500, 19: 9800, 20: 10200, 21: 10500, 22: 10800, 23: 11000
            };
            
            const currentHourMultiplier = hourMultipliers[currentHour] || 10000;
            const circadianMultiplier = (chronotypeMultiplier * currentHourMultiplier) / baseMultiplier;

            return {
              ...stat,
              rateComparison,
              circadianMultiplier,
              optimalHours: optimalData?.optimal_hours || [],
              currentHourMultiplier,
              mlBeneficial: rateComparison.ml_beneficial,
              isLoading: false,
              error: undefined
            };
          } catch (err) {
            console.warn(`Failed to load ML data for token ${stat.tokenName}:`, err);
            return {
              ...stat,
              isLoading: false,
              error: `ML data unavailable: ${err instanceof Error ? err.message : 'Unknown error'}`
            };
          }
        })
      );

      if (!mountedRef.current) return;

      updateState({ stats: enhancedStats });
      console.log('ML-enhanced data loaded successfully');

    } catch (err) {
      console.error('Failed to load ML enhanced data:', err);
      
      if (!mountedRef.current) return;
      
      // Mark all stats as having ML loading errors
      const errorStats = currentStats.map(stat => ({
        ...stat,
        isLoading: false,
        error: 'ML features unavailable'
      }));
      
      updateState({ stats: errorStats });
    }
  }, [updateState, updateCircadianInfo, getCurrentTimeStatus]);

  // ==================== EFFECT HOOKS ====================

  // Initialize component
  useEffect(() => {
    const initialize = async () => {
      console.log('Initializing TokenStatistics component...');
      
      // Load basic stats first
      await loadTokenStats(false);
      
      // Get user address
      const address = await getUserAddress();
      
      // If user is connected and we have stats, load ML data
      if (address && state.stats.length > 0) {
        await loadMLEnhancedData(address, state.stats);
      }
    };

    initialize();
  }, []); // Only run on mount

  // Load ML data when user connects or stats change
  useEffect(() => {
    if (state.showMLFeatures && state.userAddress && state.stats.length > 0 && !state.loading) {
      loadMLEnhancedData(state.userAddress, state.stats);
    }
  }, [state.showMLFeatures, state.userAddress, state.stats.length, state.loading]); // Removed loadMLEnhancedData from deps to prevent infinite loop

  // Update current time every minute
  useEffect(() => {
    const updateTime = () => {
      if (!mountedRef.current) return;
      
      const currentHour = new Date().getHours();
      const isOptimalTime = state.optimalTimes ? 
        state.optimalTimes.optimal_hours.includes(currentHour) : false;
      const nextOptimalHour = state.optimalTimes ? 
        state.optimalTimes.optimal_hours.find(hour => hour > currentHour) || state.optimalTimes.optimal_hours[0] : 
        undefined;

      updateCircadianInfo({
        currentHour,
        isOptimalTime,
        nextOptimalHour,
        timeStatus: getCurrentTimeStatus(currentHour, isOptimalTime)
      });
    };

    updateTime(); // Update immediately
    
    timeIntervalRef.current = setInterval(updateTime, 60000); // Update every minute

    return () => {
      if (timeIntervalRef.current) {
        clearInterval(timeIntervalRef.current);
        timeIntervalRef.current = null;
      }
    };
  }, [state.optimalTimes, updateCircadianInfo, getCurrentTimeStatus]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    refreshIntervalRef.current = setInterval(() => {
      if (!mountedRef.current) return;
      
      console.log('Auto-refreshing token statistics...');
      loadTokenStats(true);
      
      if (state.showMLFeatures && state.userAddress) {
        // Re-load ML data after basic stats refresh
        setTimeout(() => {
          if (mountedRef.current && state.stats.length > 0) {
            loadMLEnhancedData(state.userAddress!, state.stats);
          }
        }, 2000);
      }
    }, 300000); // 5 minutes
    
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [state.showMLFeatures, state.userAddress, state.stats.length]); // Added dependencies

  // ==================== EVENT HANDLERS ====================

  const handleRefresh = useCallback(async () => {
    console.log('Manual refresh triggered');
    await loadTokenStats(true);
    
    if (state.showMLFeatures && state.userAddress) {
      // Re-load ML data after refresh
      setTimeout(() => {
        if (mountedRef.current && state.stats.length > 0) {
          loadMLEnhancedData(state.userAddress!, state.stats);
        }
      }, 1000);
    }
  }, [loadTokenStats, state.showMLFeatures, state.userAddress, state.stats.length, loadMLEnhancedData]);

  const connectWallet = useCallback(async () => {
    try {
      await contractService.connectWallet();
      await getUserAddress();
    } catch (err) {
      console.error('Failed to connect wallet:', err);
    }
  }, [getUserAddress]);

  // ==================== RENDER HELPERS ====================

  const renderMLIndicator = (stat: MLEnhancedStats) => {
    if (stat.isLoading) {
      return <div className="ml-indicator loading">🔄 Loading</div>;
    }
    
    if (stat.error) {
      return <div className="ml-indicator error" title={stat.error}>⚠️ Error</div>;
    }
    
    if (stat.mlBeneficial !== undefined) {
      return (
        <div className={`ml-indicator ${stat.mlBeneficial ? 'beneficial' : 'standard'}`}>
          {stat.mlBeneficial ? '🚀 ML+' : '📊 STD'}
        </div>
      );
    }
    
    return null;
  };

  const renderRateComparison = (stat: MLEnhancedStats) => {
    if (!stat.rateComparison || stat.isLoading) return null;

    return (
      <div className="ml-enhanced-section">
        <h4>🧠 ML-Enhanced Rates</h4>
        
        <div className="rate-comparison-mini">
          <div className="rate-item traditional">
            <span>Traditional:</span>
            <span>{(parseFloat(stat.rateComparison.traditional_rate) * 100).toFixed(2)}%</span>
          </div>
          <div className="rate-item ml-enhanced">
            <span>ML-Enhanced:</span>
            <span>{(parseFloat(stat.rateComparison.ml_enhanced_rate) * 100).toFixed(2)}%</span>
          </div>
          <div className={`rate-item savings ${stat.rateComparison.ml_beneficial ? 'positive' : 'neutral'}`}>
            <span>Difference:</span>
            <span>
              {stat.rateComparison.ml_beneficial ? '💰 ' : ''}
              {stat.rateComparison.ml_beneficial ? '-' : '±'}
              {(parseFloat(stat.rateComparison.savings) * 100).toFixed(2)}%
            </span>
          </div>
        </div>
      </div>
    );
  };

  const renderCircadianSection = (stat: MLEnhancedStats) => {
    if (!state.showMLFeatures || !stat.circadianMultiplier || stat.isLoading) return null;

    return (
      <div className="circadian-section">
        <h4>🌊 Circadian Impact</h4>
        <div className="multiplier-display">
          <span>Current Hour Effect:</span>
          <span 
            className="multiplier-value"
            style={{ color: getMultiplierColor(stat.circadianMultiplier) }}
          >
            {formatMultiplier(stat.circadianMultiplier)}
          </span>
        </div>
        
        {stat.optimalHours && stat.optimalHours.length > 0 && (
          <div className="optimal-times">
            <span>Best Hours:</span>
            <div className="hours-list">
              {stat.optimalHours.slice(0, 3).map(hour => (
                <span 
                  key={hour} 
                  className={`hour-badge ${hour === circadianInfo.currentHour ? 'current' : ''}`}
                >
                  {hour.toString().padStart(2, '0')}:00
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ==================== MAIN RENDER ====================

  if (state.loading) {
    return (
      <div className="token-statistics loading">
        <div className="loading-spinner"></div>
        <p>Loading protocol statistics...</p>
      </div>
    );
  }

  if (state.error && state.stats.length === 0) {
    return (
      <div className="token-statistics">
        <h2>Protocol Statistics</h2>
        <div className="error-message">{state.error}</div>
        <button className="refresh-button" onClick={handleRefresh}>
          🔄 Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="token-statistics">
      {/* Header */}
      <div className="statistics-header">
        <div className="header-content">
          <h2>Protocol Statistics</h2>
          {state.showMLFeatures && circadianInfo.chronotypePrediction && (
            <div className="chronotype-badge">
              🧬 {circadianInfo.chronotypePrediction.chronotype_name} Chronotype
              {circadianInfo.chronotypePrediction.success && (
                <small className="confidence-display">
                  ({formatConfidence(circadianInfo.chronotypePrediction.confidence)} confidence)
                </small>
              )}
            </div>
          )}
        </div>
        <div className="header-actions">
          {state.showMLFeatures && (
            <div className="time-status" style={{ color: circadianInfo.timeStatus.color }}>
              {circadianInfo.timeStatus.icon} {circadianInfo.timeStatus.status} ({circadianInfo.currentHour.toString().padStart(2, '0')}:00)
            </div>
          )}
          <button 
            className={`refresh-button ${state.isRefreshing ? 'refreshing' : ''}`}
            onClick={handleRefresh} 
            disabled={state.isRefreshing}
            title="Refresh statistics"
          >
            {state.isRefreshing ? '🔄 Refreshing...' : '🔄 Refresh'}
          </button>
        </div>
      </div>

      {/* Circadian Overview */}
      {state.showMLFeatures && state.optimalTimes && (
        <div className="circadian-overview">
          <h3>⏰ Circadian Rate Information</h3>
          <div className="circadian-grid">
            <div className="circadian-item">
              <span className="label">Current Status:</span>
              <span className={`value ${circadianInfo.isOptimalTime ? 'optimal' : 'standard'}`}>
                {circadianInfo.isOptimalTime ? '✨ Optimal Time' : '📊 Standard Time'}
              </span>
            </div>
            <div className="circadian-item">
              <span className="label">Optimal Hours:</span>
              <span className="value optimal-hours">
                {state.optimalTimes.optimal_hours.map(h => h.toString().padStart(2, '0')).join(', ')}:00
              </span>
            </div>
            <div className="circadian-item">
              <span className="label">Next Optimal:</span>
              <span className="value">
                {circadianInfo.nextOptimalHour?.toString().padStart(2, '0') || '--'}:00
              </span>
            </div>
            <div className="circadian-item">
              <span className="label">Last Update:</span>
              <span className="value">
                {state.lastUpdate ? new Date(state.lastUpdate).toLocaleTimeString() : 'Never'}
              </span>
            </div>
          </div>
        </div>
      )}
      
      {/* Statistics Grid */}
      <div className="statistics-grid">
        {state.stats.map((stat) => (
          <div key={stat.tokenType} className="statistics-card">
            <div className="card-header">
              <h3>{stat.tokenName}</h3>
              {renderMLIndicator(stat)}
            </div>
            
            <div className="statistics-details">
              {/* Basic Statistics */}
              <div className="stat-row">
                <span>Total Supply:</span>
                <span>{parseFloat(stat.totalSupply).toFixed(4)} tokens</span>
              </div>
              <div className="stat-row">
                <span>Total Borrowed:</span>
                <span>{parseFloat(stat.totalBorrowed).toFixed(4)} tokens</span>
              </div>
              <div className="stat-row">
                <span>Available Liquidity:</span>
                <span>{parseFloat(stat.availableLiquidity).toFixed(4)} tokens</span>
              </div>
              
              {/* Utilization Rate */}
              <div className="utilization-container">
                <div className="utilization-label">
                  <span>Utilization Rate:</span>
                  <span style={{ color: getUtilizationColor(stat.utilizationRate) }}>
                    {stat.utilizationRate.toFixed(2)}%
                  </span>
                </div>
                <div className="utilization-bar">
                  <div 
                    className="utilization-fill" 
                    style={{ 
                      width: `${Math.min(100, stat.utilizationRate)}%`,
                      backgroundColor: getUtilizationColor(stat.utilizationRate)
                    }}
                  />
                </div>
              </div>

              {/* ML-Enhanced Information */}
              {renderRateComparison(stat)}

              {/* Circadian Multiplier */}
              {renderCircadianSection(stat)}

              {/* Error Display */}
              {stat.error && (
                <div className="stat-error">
                  <small>⚠️ {stat.error}</small>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ML Features Prompt for Non-Connected Users */}
      {!state.showMLFeatures && (
        <div className="ml-prompt">
          <div className="ml-prompt-content">
            <h3>🚀 Unlock ML-Enhanced Features</h3>
            <p>Connect your wallet to see:</p>
            <ul>
              <li>🧠 ML-enhanced interest rates</li>
              <li>⏰ Circadian rhythm optimizations</li>
              <li>📊 Personalized rate comparisons</li>
              <li>🎯 Optimal borrowing times</li>
              <li>📈 Real-time performance analytics</li>
            </ul>
            <button className="connect-wallet-button" onClick={connectWallet}>
              Connect Wallet
            </button>
          </div>
        </div>
      )}

      {/* Error Display */}
      {state.error && state.stats.length > 0 && (
        <div className="error-banner">
          <span>⚠️ {state.error}</span>
          <button onClick={() => updateState({ error: null })}>✕</button>
        </div>
      )}
    </div>
  );
};

export default TokenStatistics;
