/**
 * CircadianMLDashboard.tsx
 * Main ML analytics dashboard displaying user chronotype insights,
 * activity patterns, and optimal borrowing recommendations
 * Fixed version with proper error handling and debugging
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import mlService, { 
  ChronotypePrediction, 
  UserInsights, 
  ActivityPattern, 
  MLAPIHealth,
  MLAnalytics 
} from '../services/MLService';
import contractService, { UserMLInsights } from '../services/ContractService';
import './CircadianMLDashboard.css';

// ==================== INTERFACES ====================

interface DashboardState {
  isLoading: boolean;
  mlHealth: MLAPIHealth | null;
  chronotypePrediction: ChronotypePrediction | null;
  userInsights: UserInsights | null;
  contractInsights: UserMLInsights | null;
  activityPattern: ActivityPattern | null;
  error: string | null;
  lastUpdate: number;
}

interface ActivityInputProps {
  onPatternChange: (pattern: number[]) => void;
  currentPattern: number[] | null;
}

interface ChronotypeDisplayProps {
  prediction: ChronotypePrediction;
  insights: UserInsights | null;
}

interface OptimalTimesProps {
  insights: UserInsights;
  contractInsights: UserMLInsights | null;
}

interface MLHealthStatusProps {
  health: MLAPIHealth;
  isOnline: boolean;
}

// ==================== ACTIVITY PATTERN INPUT COMPONENT ====================

const ActivityPatternInput: React.FC<ActivityInputProps> = ({ onPatternChange, currentPattern }) => {
  const [inputMode, setInputMode] = useState<'manual' | 'sample'>('sample');
  const [sampleType, setSampleType] = useState<'early' | 'intermediate' | 'late'>('intermediate');
  const [manualPattern, setManualPattern] = useState<number[]>(new Array(24).fill(0));
  const [isGenerating, setIsGenerating] = useState(false);

  // Initialize manual pattern from current pattern
  useEffect(() => {
    if (currentPattern && currentPattern.length === 24) {
      setManualPattern([...currentPattern]);
      console.log('Manual pattern updated from current:', currentPattern);
    }
  }, [currentPattern]);

  const handleGenerateSample = useCallback(async () => {
    console.log(`Generating ${sampleType} chronotype pattern...`);
    setIsGenerating(true);
    
    try {
      const activityPattern = mlService.generateSampleActivityPattern(sampleType);
      console.log('Generated activity pattern:', activityPattern);
      console.log('Pattern values:', activityPattern.values);
      console.log('Pattern length:', activityPattern.values.length);
      console.log('All values are numbers:', activityPattern.values.every(v => typeof v === 'number'));
      
      if (activityPattern.values && activityPattern.values.length === 24) {
        onPatternChange(activityPattern.values);
        console.log('Pattern change triggered successfully');
      } else {
        console.error('Generated pattern is invalid:', activityPattern);
        throw new Error('Generated pattern is invalid');
      }
    } catch (error) {
      console.error('Pattern generation failed:', error);
      // Generate fallback pattern
      const fallbackPattern = Array.from({ length: 24 }, (_, i) => {
        if (sampleType === 'early') {
          return i >= 6 && i <= 10 ? 800 + Math.random() * 200 : 200 + Math.random() * 100;
        } else if (sampleType === 'late') {
          return i >= 19 || i <= 2 ? 800 + Math.random() * 200 : 200 + Math.random() * 100;
        } else {
          return i >= 9 && i <= 17 ? 600 + Math.random() * 300 : 200 + Math.random() * 200;
        }
      });
      console.log('Using fallback pattern:', fallbackPattern);
      onPatternChange(fallbackPattern);
    } finally {
      setIsGenerating(false);
    }
  }, [sampleType, onPatternChange]);

  const handleManualChange = useCallback((hour: number, value: number) => {
    const newPattern = [...manualPattern];
    const cleanValue = Math.max(0, Math.min(1000, Math.round(value) || 0));
    newPattern[hour] = cleanValue;
    setManualPattern(newPattern);
    console.log(`Manual pattern updated for hour ${hour}: ${cleanValue}`);
    onPatternChange(newPattern);
  }, [manualPattern, onPatternChange]);

  const resetPattern = useCallback(() => {
    const resetPattern = new Array(24).fill(0);
    setManualPattern(resetPattern);
    onPatternChange(resetPattern);
    console.log('Pattern reset to zeros');
  }, [onPatternChange]);

  return (
    <div className="activity-pattern-card">
      <h3 className="pattern-input-title">
        📊 Activity Pattern Input
      </h3>
      
      {/* Input Mode Selection */}
      <div className="mode-selector">
        <button
          onClick={() => setInputMode('sample')}
          className={`mode-button ${inputMode === 'sample' ? 'active' : 'inactive'}`}
        >
          Sample Patterns
        </button>
        <button
          onClick={() => setInputMode('manual')}
          className={`mode-button ${inputMode === 'manual' ? 'active' : 'inactive'}`}
        >
          Manual Input
        </button>
      </div>

      {/* Sample Pattern Mode */}
      {inputMode === 'sample' && (
        <div className="sample-controls">
          <div>
            <label className="chronotype-selector-label">
              Select Chronotype Pattern:
            </label>
            <select
              value={sampleType}
              onChange={(e) => setSampleType(e.target.value as 'early' | 'intermediate' | 'late')}
              className="chronotype-selector"
            >
              <option value="early">🌅 Early Chronotype (Morning Person)</option>
              <option value="intermediate">☀️ Intermediate Chronotype (Balanced)</option>
              <option value="late">🌙 Late Chronotype (Night Person)</option>
            </select>
          </div>
          <button
            onClick={handleGenerateSample}
            disabled={isGenerating}
            className={`generate-button ${isGenerating ? 'generating' : ''}`}
          >
            {isGenerating ? '⏳ Generating...' : 'Generate Sample Pattern'}
          </button>
        </div>
      )}

      {/* Manual Input Mode */}
      {inputMode === 'manual' && (
        <div className="manual-controls">
          <div className="manual-header">
            <label className="manual-label">
              Activity Level by Hour (0-1000):
            </label>
            <button
              onClick={resetPattern}
              className="reset-button"
            >
              Reset All
            </button>
          </div>
          
          <div className="hour-grid">
            {Array.from({ length: 24 }, (_, hour) => (
              <div key={hour} className="hour-input-group">
                <label className="hour-label">
                  {hour.toString().padStart(2, '0')}:00
                </label>
                <input
                  type="number"
                  min="0"
                  max="1000"
                  value={manualPattern[hour]}
                  onChange={(e) => handleManualChange(hour, parseInt(e.target.value) || 0)}
                  className="hour-input"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pattern Visualization */}
      {(currentPattern && currentPattern.length === 24) && (
        <div className="pattern-visualization">
          <h4 className="visualization-title">Current Pattern:</h4>
          <div className="pattern-chart">
            {currentPattern.map((value, hour) => (
              <div
                key={hour}
                className="pattern-bar"
                style={{ height: `${Math.max(2, (value / 1000) * 100)}%` }}
                title={`${hour}:00 - Activity: ${value}`}
              />
            ))}
          </div>
          <div className="time-labels">
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>23:00</span>
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== CHRONOTYPE DISPLAY COMPONENT ====================

const ChronotypeDisplay: React.FC<ChronotypeDisplayProps> = ({ prediction, insights }) => {
  const getChronotypeIcon = (chronotype: number): string => {
    switch (chronotype) {
      case 0: return '🌅';
      case 2: return '🌙';
      default: return '☀️';
    }
  };

  const getChronotypeDescription = (chronotype: number): string => {
    switch (chronotype) {
      case 0: return 'You are a morning person with peak performance in early hours';
      case 2: return 'You are a night person with peak performance in evening hours';
      default: return 'You have a balanced chronotype with flexibility throughout the day';
    }
  };

  const getConfidenceLevel = (confidence: number): { level: string; className: string } => {
    console.log('Processing confidence value:', confidence);
    
    if (confidence >= 900) return { level: 'Very High', className: 'confidence-very-high' };
    if (confidence >= 800) return { level: 'High', className: 'confidence-high' };
    if (confidence >= 700) return { level: 'Medium-High', className: 'confidence-medium-high' };
    if (confidence >= 600) return { level: 'Medium', className: 'confidence-medium' };
    if (confidence >= 400) return { level: 'Medium-Low', className: 'confidence-medium-low' };
    if (confidence >= 200) return { level: 'Low', className: 'confidence-low' };
    return { level: 'Very Low', className: 'confidence-very-low' };
  };

  // ✅ FIXED: Proper confidence display
  const displayConfidence = useMemo(() => {
    console.log('Raw confidence from prediction:', prediction.confidence);
    
    // MLService now returns confidence in 0-1000 range
    const percentage = Math.round(prediction.confidence / 10); // Convert 1000 -> 100%
    console.log('Converted to percentage:', percentage);
    return percentage;
  }, [prediction.confidence]);

  const confidenceInfo = getConfidenceLevel(prediction.confidence);

  return (
    <div className="chronotype-card">
      <h3 className="chronotype-title">
        🧬 Your Chronotype Analysis
      </h3>

      {prediction.success ? (
        <div className="chronotype-content">
          {/* Main Chronotype Display */}
          <div className="chronotype-main-display">
            <div className="chronotype-icon">{getChronotypeIcon(prediction.chronotype)}</div>
            <h4 className="chronotype-name">
              {prediction.chronotype_name} Chronotype
            </h4>
            <p className="chronotype-description">
              {getChronotypeDescription(prediction.chronotype)}
            </p>
            <div className="confidence-display">
              <span className="confidence-label">Confidence:</span>
              <span className={`confidence-value ${confidenceInfo.className}`}>
                {displayConfidence}% ({confidenceInfo.level})
              </span>
            </div>
          </div>

          {/* Detailed Insights */}
          {insights && insights.success && (
            <div className="insights-grid">
              {/* Peak Activity */}
              <div className="insight-card peak-activity">
                <h5 className="insight-card-title">⏰ Peak Activity</h5>
                <p className="peak-time">
                  {insights.peak_activity_hour.toString().padStart(2, '0')}:00
                </p>
                <p className="insight-description">
                  Your highest activity hour
                </p>
              </div>

              {/* Activity Summary */}
              <div className="insight-card activity-summary">
                <h5 className="insight-card-title">📈 Activity Summary</h5>
                <div className="activity-summary-list">
                  <div className="activity-row">
                    <span className="activity-label">Morning:</span>
                    <span className="activity-value">{Math.round(insights.activity_summary.morning_avg)}</span>
                  </div>
                  <div className="activity-row">
                    <span className="activity-label">Afternoon:</span>
                    <span className="activity-value">{Math.round(insights.activity_summary.afternoon_avg)}</span>
                  </div>
                  <div className="activity-row">
                    <span className="activity-label">Evening:</span>
                    <span className="activity-value">{Math.round(insights.activity_summary.evening_avg)}</span>
                  </div>
                  <div className="activity-row">
                    <span className="activity-label">Night:</span>
                    <span className="activity-value">{Math.round(insights.activity_summary.night_avg)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="chronotype-error">
          <div className="error-icon">❌</div>
          <h4 className="error-title">
            Analysis Failed
          </h4>
          <p className="error-message">
            {prediction.error || 'Unable to analyze chronotype. Please try again.'}
          </p>
        </div>
      )}
    </div>
  );
};

// ==================== OPTIMAL TIMES COMPONENT ====================

const OptimalTimes: React.FC<OptimalTimesProps> = ({ insights, contractInsights }) => {
  const formatHour = (hour: number): string => {
    return hour.toString().padStart(2, '0') + ':00';
  };

  const getTimeOfDayLabel = (hour: number): string => {
    if (hour >= 6 && hour < 12) return 'Morning';
    if (hour >= 12 && hour < 18) return 'Afternoon';
    if (hour >= 18 && hour < 22) return 'Evening';
    return 'Night';
  };

  return (
    <div className="optimal-times-card">
      <h3 className="optimal-times-title">
        ⏰ Optimal Borrowing Times
      </h3>

      {insights.success && insights.optimal_borrowing_hours.length > 0 ? (
        <div className="optimal-times-content">
          {/* Recommended Hours */}
          <div className="optimal-hours-section">
            <h4 className="section-title">🎯 Best Times for You:</h4>
            <div className="optimal-hours-grid">
              {insights.optimal_borrowing_hours.map((hour) => (
                <div
                  key={hour}
                  className="optimal-hour-badge"
                >
                  <div className="optimal-hour-time">{formatHour(hour)}</div>
                  <div className="optimal-hour-period">{getTimeOfDayLabel(hour)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Benefits Explanation */}
          <div className="benefits-section">
            <h5 className="benefits-title">💡 Why These Times?</h5>
            <p className="benefits-description">
              Based on your <strong>{insights.chronotype_name}</strong> chronotype, these hours align with your 
              natural circadian rhythm, potentially resulting in:
            </p>
            <ul className="benefits-list">
              <li>Better decision-making ability</li>
              <li>Lower interest rates (up to 15-20% savings)</li>
              <li>Reduced cognitive stress during financial decisions</li>
              <li>Improved loan management performance</li>
            </ul>
          </div>

          {/* Contract Insights Integration */}
          {contractInsights && contractInsights.total_sessions > 0 && (
            <div className="contract-insights">
              <h5 className="contract-insights-title">📊 Your Lending History</h5>
              <div className="contract-stats-grid">
                <div className="contract-stat">
                  <span className="contract-stat-label">Total Sessions:</span>
                  <span className="contract-stat-value">{contractInsights.total_sessions.toString()}</span>
                </div>
                <div className="contract-stat">
                  <span className="contract-stat-label">Consistency Score:</span>
                  <span className="contract-stat-value">{contractInsights.consistency_score.toString()}/1000</span>
                </div>
                <div className="contract-stat">
                  <span className="contract-stat-label">Risk Score:</span>
                  <span className="contract-stat-value">{contractInsights.risk_score.toString()}/1000</span>
                </div>
                <div className="contract-stat">
                  <span className="contract-stat-label">ML Confidence:</span>
                  <span className="contract-stat-value">{Math.round(contractInsights.ml_confidence / 10)}%</span>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="no-optimal-times">
          <div className="no-data-icon">⏳</div>
          <p className="no-data-message">
            Provide an activity pattern to see your optimal borrowing times
          </p>
        </div>
      )}
    </div>
  );
};

// ==================== ML HEALTH STATUS COMPONENT ====================

const MLHealthStatus: React.FC<MLHealthStatusProps> = ({ health, isOnline }) => {
  const getStatusIcon = (status: string, modelsLoaded: boolean): string => {
    if (status === 'healthy' && modelsLoaded) return '✅';
    if (status === 'healthy' && !modelsLoaded) return '⚠️';
    return '❌';
  };

  const getStatusText = (status: string, modelsLoaded: boolean): string => {
    if (status === 'healthy' && modelsLoaded) return 'Ready';
    if (status === 'healthy' && !modelsLoaded) return 'Loading';
    return 'Error';
  };

  return (
    <div className="ml-health-card">
      <h4 className="ml-health-title">🔧 ML System Status</h4>
      
      <div className="health-status-grid">
        <div className="health-status-item">
          <div className="health-status-icon">
            {getStatusIcon(health.status, health.models_loaded)}
          </div>
          <div className="health-status-text">
            {isOnline ? 'Online' : 'Offline'}
          </div>
          <div className="health-status-label">Connection</div>
        </div>
        
        <div className="health-status-item">
          <div className="health-status-icon">
            {health.models_loaded ? '🧠' : '⚪'}
          </div>
          <div className="health-status-text">
            {health.models_loaded ? 'Loaded' : 'Not Loaded'}
          </div>
          <div className="health-status-label">ML Models</div>
        </div>
        
        <div className="health-status-item">
          <div className="health-status-icon">ℹ️</div>
          <div className="health-status-text">
            {health.version}
          </div>
          <div className="health-status-label">Version</div>
        </div>

        <div className="health-status-item">
          <div className="health-status-icon">
            {getStatusIcon(health.status, health.models_loaded)}
          </div>
          <div className="health-status-text">
            {getStatusText(health.status, health.models_loaded)}
          </div>
          <div className="health-status-label">Status</div>
        </div>
      </div>
    </div>
  );
};

// ==================== MAIN DASHBOARD COMPONENT ====================

const CircadianMLDashboard: React.FC = () => {
  const [state, setState] = useState<DashboardState>({
    isLoading: false,
    mlHealth: null,
    chronotypePrediction: null,
    userInsights: null,
    contractInsights: null,
    activityPattern: null,
    error: null,
    lastUpdate: 0
  });

  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<MLAnalytics | null>(null);

  // Get current user address
  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        if (contractService.signer) {
          const address = await contractService.signer.getAddress();
          setUserAddress(address);
          console.log('Dashboard connected to user:', address);
        }
      } catch (error) {
        console.warn('Could not get user address:', error);
      }
    };

    getCurrentUser();
  }, []);

  // Initialize ML health check
  useEffect(() => {
    const checkMLHealth = async () => {
      try {
        console.log('Checking ML health...');
        const health = await mlService.checkHealth();
        const analytics = mlService.getAnalytics();
        
        console.log('ML Health:', health);
        console.log('ML Analytics:', analytics);
        
        setState(prev => ({ ...prev, mlHealth: health }));
        setAnalytics(analytics);
      } catch (error) {
        console.error('Failed to check ML health:', error);
      }
    };

    checkMLHealth();
    
    // Check health every 30 seconds
    const interval = setInterval(checkMLHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  // Analyze activity pattern with enhanced error handling
  const analyzePattern = useCallback(async (pattern: number[]) => {
    console.log('Starting pattern analysis with pattern:', pattern);
    console.log('Pattern validation:', {
      isArray: Array.isArray(pattern),
      length: pattern?.length,
      allNumbers: pattern?.every(v => typeof v === 'number'),
      hasValidValues: pattern?.every(v => v >= 0 && isFinite(v))
    });

    if (!pattern || pattern.length !== 24) {
      const errorMsg = `Invalid activity pattern: ${pattern ? `length ${pattern.length}` : 'null/undefined'}`;
      console.error(errorMsg);
      setState(prev => ({ 
        ...prev, 
        error: 'Invalid activity pattern provided. Please ensure you have 24 hourly values.' 
      }));
      return;
    }

    // Additional validation
    if (!pattern.every(v => typeof v === 'number' && v >= 0 && isFinite(v))) {
      console.error('Pattern contains invalid values:', pattern.filter(v => typeof v !== 'number' || v < 0 || !isFinite(v)));
      setState(prev => ({ 
        ...prev, 
        error: 'Activity pattern contains invalid values. All values must be non-negative numbers.' 
      }));
      return;
    }

    setState(prev => ({ 
      ...prev, 
      isLoading: true, 
      error: null,
      activityPattern: {
        hours: Array.from({ length: 24 }, (_, i) => i),
        values: pattern,
        timestamp: Date.now(),
        source: 'user_input'
      }
    }));

    try {
      console.log('Making ML API calls...');
      
      // Get ML predictions with detailed logging
      const chronotypePrediction = await mlService.predictChronotype(pattern);
      console.log('Chronotype prediction result:', chronotypePrediction);
      
      const userInsights = await mlService.getUserInsights(pattern);
      console.log('User insights result:', userInsights);

      // Get contract insights if user is connected
      let contractInsights: UserMLInsights | null = null;
      if (userAddress) {
        try {
          contractInsights = await contractService.getUserMLCircadianInsights(userAddress);
          console.log('Contract insights result:', contractInsights);
        } catch (error) {
          console.warn('Could not get contract insights (this is normal if no previous loans):', error);
        }
      }

      setState(prev => ({
        ...prev,
        isLoading: false,
        chronotypePrediction,
        userInsights,
        contractInsights,
        lastUpdate: Date.now()
      }));

      // Update analytics
      const newAnalytics = mlService.getAnalytics();
      setAnalytics(newAnalytics);
      console.log('Analysis completed successfully');

    } catch (error) {
      console.error('Pattern analysis failed:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Analysis failed. Please check your connection and try again.'
      }));
    }
  }, [userAddress]);

  // Handle pattern change with debouncing
  const handlePatternChange = useCallback((pattern: number[]) => {
    console.log('Pattern change requested:', pattern);
    analyzePattern(pattern);
  }, [analyzePattern]);

  // Memoized service status
  const serviceStatus = useMemo(() => {
    if (!state.mlHealth) return { isOnline: false, lastCheck: 0, nextCheck: 0 };
    return mlService.getServiceStatus();
  }, [state.mlHealth]);

  // Error dismissal
  const dismissError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return (
    <div className="circadian-ml-dashboard">
      <div className="dashboard-container">
        {/* Header */}
        <div className="dashboard-header">
          <h1 className="dashboard-title">
            🧬 Circadian ML Dashboard
          </h1>
          <p className="dashboard-subtitle">
            Discover your chronotype and optimize your DeFi borrowing with machine learning
          </p>
          {userAddress && (
            <p className="user-address">
              Connected: {userAddress.slice(0, 6)}...{userAddress.slice(-4)}
            </p>
          )}
        </div>

        {/* ML Health Status */}
        {state.mlHealth && (
          <MLHealthStatus 
            health={state.mlHealth} 
            isOnline={serviceStatus.isOnline} 
          />
        )}

        {/* Analytics Summary */}
        {analytics && analytics.total_predictions > 0 && (
          <div className="analytics-summary-card">
            <h3 className="analytics-title">
              📈 ML Analytics Summary
            </h3>
            <div className="analytics-grid">
              <div className="analytics-item">
                <div className="analytics-value blue">
                  {analytics.total_predictions}
                </div>
                <div className="analytics-label">Total Predictions</div>
              </div>
              <div className="analytics-item">
                <div className="analytics-value green">
                  {analytics.successful_predictions}
                </div>
                <div className="analytics-label">Successful</div>
              </div>
              <div className="analytics-item">
                <div className="analytics-value purple">
                  {Math.round(analytics.average_confidence / 10)}%
                </div>
                <div className="analytics-label">Avg Confidence</div>
              </div>
              <div className="analytics-item">
                <div className="analytics-value orange">
                  {analytics.chronotype_distribution.early + 
                   analytics.chronotype_distribution.intermediate + 
                   analytics.chronotype_distribution.late}
                </div>
                <div className="analytics-label">Classifications</div>
              </div>
            </div>
          </div>
        )}

        {/* Activity Pattern Input */}
        <ActivityPatternInput
          onPatternChange={handlePatternChange}
          currentPattern={state.activityPattern?.values || null}
        />

        {/* Loading State */}
        {state.isLoading && (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <h3 className="loading-title">
              Analyzing Your Chronotype...
            </h3>
            <p className="loading-description">
              Our ML models are processing your activity pattern
            </p>
          </div>
        )}

        {/* Error State */}
        {state.error && (
          <div className="error-container">
            <div className="error-header">
              <span className="error-icon">⚠️</span>
              <h3 className="error-title">Analysis Error</h3>
            </div>
            <p className="error-message">{state.error}</p>
            <button
              onClick={dismissError}
              className="error-dismiss"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Results */}
        {!state.isLoading && state.chronotypePrediction && (
          <>
            {/* Chronotype Display */}
            <ChronotypeDisplay
              prediction={state.chronotypePrediction}
              insights={state.userInsights}
            />

            {/* Optimal Times */}
            {state.userInsights && (
              <OptimalTimes
                insights={state.userInsights}
                contractInsights={state.contractInsights}
              />
            )}
          </>
        )}

        {/* Getting Started Message */}
        {!state.activityPattern && !state.isLoading && (
          <div className="getting-started-card">
            <div className="getting-started-icon">🚀</div>
            <h3 className="getting-started-title">
              Get Started with ML-Enhanced DeFi
            </h3>
            <p className="getting-started-description">
              Input your activity pattern above to discover your chronotype and receive 
              personalized recommendations for optimal borrowing times with better interest rates.
            </p>
            <div className="features-grid">
              <div className="feature-item">
                <div className="feature-icon">📊</div>
                <h4 className="feature-title">Analyze Patterns</h4>
                <p className="feature-description">
                  Our ML models analyze your 24-hour activity patterns
                </p>
              </div>
              <div className="feature-item">
                <div className="feature-icon">🧬</div>
                <h4 className="feature-title">Detect Chronotype</h4>
                <p className="feature-description">
                  Discover if you're an early, intermediate, or late chronotype
                </p>
              </div>
              <div className="feature-item">
                <div className="feature-icon">💰</div>
                <h4 className="feature-title">Optimize Rates</h4>
                <p className="feature-description">
                  Get better interest rates by borrowing at optimal times
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Last Update Info */}
        {state.lastUpdate > 0 && (
          <div className="last-update-info">
            Last analysis: {new Date(state.lastUpdate).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
};

export default CircadianMLDashboard;
