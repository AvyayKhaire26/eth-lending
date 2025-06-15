/**
 * ChronotypeAnalytics.tsx
 * Detailed chronotype analysis and behavioral insights dashboard
 * Provides comprehensive borrowing pattern analysis and optimization recommendations
 * Fixed version with custom CSS and proper error handling
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import contractService, { 
  UserMLInsights, 
  OptimalBorrowingTimes,
  RateComparison,
  TokenInfo,
  LoanInfo
} from '../services/ContractService';
import mlService, { 
  ChronotypePrediction, 
  UserInsights,
  ActivityPattern,
  MLAnalytics 
} from '../services/MLService';
import './ChronotypeAnalytics.css';

// ==================== INTERFACES ====================

interface AnalyticsState {
  isLoading: boolean;
  userAddress: string | null;
  contractInsights: UserMLInsights | null;
  mlPrediction: ChronotypePrediction | null;
  mlInsights: UserInsights | null;
  optimalTimes: OptimalBorrowingTimes | null;
  userLoans: LoanInfo[];
  tokens: TokenInfo[];
  rateComparisons: RateComparison[];
  activityPattern: ActivityPattern | null;
  analytics: MLAnalytics | null;
  error: string | null;
  lastUpdate: number;
}

interface ChronotypeOverviewProps {
  prediction: ChronotypePrediction;
  insights: UserInsights;
  contractInsights: UserMLInsights;
}

interface BehaviorPatternsProps {
  userLoans: LoanInfo[];
  contractInsights: UserMLInsights;
  tokens: TokenInfo[];
}

interface ActivityVisualizationProps {
  activityPattern: ActivityPattern;
  insights: UserInsights;
  optimalTimes: OptimalBorrowingTimes;
}

interface PerformanceMetricsProps {
  contractInsights: UserMLInsights;
  rateComparisons: RateComparison[];
  userLoans: LoanInfo[];
}

interface OptimizationTipsProps {
  prediction: ChronotypePrediction;
  contractInsights: UserMLInsights;
  optimalTimes: OptimalBorrowingTimes;
}

interface HistoricalAnalysisProps {
  userLoans: LoanInfo[];
  tokens: TokenInfo[];
  contractInsights: UserMLInsights;
}

// ==================== CHRONOTYPE OVERVIEW COMPONENT ====================

const ChronotypeOverview: React.FC<ChronotypeOverviewProps> = ({ 
  prediction, 
  insights, 
  contractInsights 
}) => {
  const getChronotypeIcon = (chronotype: number): string => {
    switch (chronotype) {
      case 0: return '🌅';
      case 2: return '🌙';
      default: return '☀️';
    }
  };

  const getChronotypeDescription = (chronotype: number): string => {
    switch (chronotype) {
      case 0: return 'You are most alert and productive in the early morning hours (6-10 AM). Your cognitive performance peaks during sunrise hours, making this your optimal time for important financial decisions.';
      case 2: return 'You reach peak performance during evening and night hours (8 PM - 2 AM). Your decision-making abilities are strongest when most people are winding down.';
      default: return 'You have a balanced chronotype with good performance throughout the day, with peak hours typically in mid-morning to early afternoon (9 AM - 5 PM).';
    }
  };

  const getConfidenceLevel = (confidence: number): { level: string; className: string; description: string } => {
    // Fix confidence scaling - convert to percentage
    const percentage = Math.round(confidence / 10);
    
    if (percentage >= 90) return { 
      level: 'Very High', 
      className: 'confidence-very-high', 
      description: 'Extremely confident prediction with consistent behavioral patterns' 
    };
    if (percentage >= 80) return { 
      level: 'High', 
      className: 'confidence-high', 
      description: 'Strong confidence with clear behavioral indicators' 
    };
    if (percentage >= 70) return { 
      level: 'Good', 
      className: 'confidence-good', 
      description: 'Good confidence with observable patterns' 
    };
    if (percentage >= 60) return { 
      level: 'Moderate', 
      className: 'confidence-moderate', 
      description: 'Moderate confidence, may need more data' 
    };
    return { 
      level: 'Low', 
      className: 'confidence-low', 
      description: 'Low confidence, requires more behavioral data' 
    };
  };

  const confidenceInfo = getConfidenceLevel(prediction.confidence);
  const displayConfidence = Math.round(prediction.confidence / 10); // Convert 1000 -> 100%

  return (
    <div className="chronotype-overview-card">
      <h3 className="overview-title">
        🧬 Chronotype Analysis Overview
      </h3>

      <div className="overview-grid">
        {/* Main Chronotype Display */}
        <div className="chronotype-main-display">
          <div className="chronotype-icon">{getChronotypeIcon(prediction.chronotype)}</div>
          <h4 className="chronotype-name">
            {prediction.chronotype_name}
          </h4>
          <div className={`confidence-badge ${confidenceInfo.className}`}>
            {confidenceInfo.level} Confidence ({displayConfidence}%)
          </div>
          <p className="chronotype-description">
            {getChronotypeDescription(prediction.chronotype)}
          </p>
        </div>

        {/* Key Metrics */}
        <div className="key-analytics">
          <h5 className="analytics-section-title">📊 Key Analytics</h5>
          
          <div className="analytics-metrics-grid">
            <div className="metric-card purple">
              <div className="metric-label">Peak Activity</div>
              <div className="metric-value">
                {insights.peak_activity_hour.toString().padStart(2, '0')}:00
              </div>
            </div>
            
            <div className="metric-card green">
              <div className="metric-label">Consistency</div>
              <div className="metric-value">
                {contractInsights.consistency_score}/1000
              </div>
            </div>
            
            <div className="metric-card blue">
              <div className="metric-label">Sessions</div>
              <div className="metric-value">
                {contractInsights.total_sessions.toString()}
              </div>
            </div>
            
            <div className="metric-card orange">
              <div className="metric-label">Risk Score</div>
              <div className="metric-value">
                {contractInsights.risk_score}/1000
              </div>
            </div>
          </div>

          {/* Activity Summary */}
          <div className="activity-summary-card">
            <h6 className="activity-summary-title">Activity Distribution</h6>
            <div className="activity-summary-list">
              <div className="activity-summary-row">
                <span className="activity-summary-label">Morning (6-12):</span>
                <span className="activity-summary-value">{insights.activity_summary.morning_avg.toFixed(0)}</span>
              </div>
              <div className="activity-summary-row">
                <span className="activity-summary-label">Afternoon (12-18):</span>
                <span className="activity-summary-value">{insights.activity_summary.afternoon_avg.toFixed(0)}</span>
              </div>
              <div className="activity-summary-row">
                <span className="activity-summary-label">Evening (18-24):</span>
                <span className="activity-summary-value">{insights.activity_summary.evening_avg.toFixed(0)}</span>
              </div>
              <div className="activity-summary-row">
                <span className="activity-summary-label">Night (0-6):</span>
                <span className="activity-summary-value">{insights.activity_summary.night_avg.toFixed(0)}</span>
              </div>
            </div>
          </div>

          {/* Confidence Explanation */}
          <div className={`confidence-explanation ${confidenceInfo.className}`}>
            <strong>Confidence Level:</strong> {confidenceInfo.description}
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== BEHAVIOR PATTERNS COMPONENT ====================

const BehaviorPatterns: React.FC<BehaviorPatternsProps> = ({ userLoans, contractInsights, tokens }) => {
  const [selectedTimeframe, setSelectedTimeframe] = useState<'week' | 'month' | 'all'>('month');

  const getTokenName = useCallback((tokenType: number): string => {
    const token = tokens.find(t => t.type === tokenType);
    return token ? token.name.split(' ')[0] : 'Unknown';
  }, [tokens]);

  const filterLoansByTimeframe = useCallback((loans: LoanInfo[]): LoanInfo[] => {
    const now = Math.floor(Date.now() / 1000);
    const timeframes = {
      week: 7 * 24 * 60 * 60,
      month: 30 * 24 * 60 * 60,
      all: Infinity
    };
    
    const cutoff = now - timeframes[selectedTimeframe];
    return loans.filter(loan => loan.issuanceTimestamp >= cutoff);
  }, [selectedTimeframe]);

  const filteredLoans = useMemo(() => filterLoansByTimeframe(userLoans), [userLoans, filterLoansByTimeframe]);

  const calculatePatterns = useMemo(() => {
    if (filteredLoans.length === 0) return null;

    // Hour distribution
    const hourCounts = new Array(24).fill(0);
    filteredLoans.forEach(loan => {
      const hour = new Date(loan.issuanceTimestamp * 1000).getHours();
      hourCounts[hour]++;
    });

    // Token preference
    const tokenCounts: { [key: number]: number } = {};
    filteredLoans.forEach(loan => {
      tokenCounts[loan.tokenType] = (tokenCounts[loan.tokenType] || 0) + 1;
    });

    // Amount patterns
    const amounts = filteredLoans.map(loan => parseFloat(loan.tokenAmount));
    const avgAmount = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;
    const maxAmount = Math.max(...amounts);
    const minAmount = Math.min(...amounts);

    return {
      hourCounts,
      tokenCounts,
      avgAmount,
      maxAmount,
      minAmount,
      totalLoans: filteredLoans.length
    };
  }, [filteredLoans]);

  return (
    <div className="behavior-patterns-card">
      <div className="patterns-header">
        <h3 className="patterns-title">
          📈 Borrowing Behavior Patterns
        </h3>
        
        {/* Timeframe Selector */}
        <div className="timeframe-selector">
          {(['week', 'month', 'all'] as const).map((timeframe) => (
            <button
              key={timeframe}
              onClick={() => setSelectedTimeframe(timeframe)}
              className={`timeframe-button ${
                selectedTimeframe === timeframe ? 'active' : 'inactive'
              }`}
            >
              {timeframe === 'all' ? 'All Time' : timeframe.charAt(0).toUpperCase() + timeframe.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="patterns-content">
        {calculatePatterns ? (
          <>
            {/* Summary Stats */}
            <div className="summary-stats-grid">
              <div className="summary-stat-card blue">
                <div className="summary-stat-value">{calculatePatterns.totalLoans}</div>
                <div className="summary-stat-label">Total Loans</div>
              </div>
              <div className="summary-stat-card green">
                <div className="summary-stat-value">{calculatePatterns.avgAmount.toFixed(2)}</div>
                <div className="summary-stat-label">Avg Amount</div>
              </div>
              <div className="summary-stat-card purple">
                <div className="summary-stat-value">{calculatePatterns.maxAmount.toFixed(2)}</div>
                <div className="summary-stat-label">Max Amount</div>
              </div>
              <div className="summary-stat-card orange">
                <div className="summary-stat-value">{contractInsights.consistency_score}</div>
                <div className="summary-stat-label">Consistency</div>
              </div>
            </div>

            {/* Hourly Distribution */}
            <div className="hourly-distribution">
              <h4 className="distribution-title">⏰ Borrowing Hours Distribution</h4>
              <div className="distribution-chart">
                <div className="hour-bars-grid">
                  {calculatePatterns.hourCounts.map((count, hour) => (
                    <div key={hour} className="hour-bar-container">
                      <div
                        className="hour-bar"
                        style={{
                          height: `${count === 0 ? 2 : (count / Math.max(...calculatePatterns.hourCounts)) * 60}px`,
                          minHeight: '2px'
                        }}
                        title={`${hour.toString().padStart(2, '0')}:00 - ${count} loans`}
                      />
                      <div className="hour-label">
                        {hour % 4 === 0 ? hour.toString().padStart(2, '0') : ''}
                      </div>
                    </div>
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
            </div>

            {/* Token Preferences */}
            <div className="token-preferences">
              <h4 className="preferences-title">🎯 Token Preferences</h4>
              <div className="preference-list">
                {Object.entries(calculatePatterns.tokenCounts)
                  .sort(([,a], [,b]) => b - a)
                  .map(([tokenType, count]) => {
                    const percentage = (count / calculatePatterns.totalLoans) * 100;
                    return (
                      <div key={tokenType} className="preference-item">
                        <div className="preference-token-name">
                          {getTokenName(parseInt(tokenType))}
                        </div>
                        <div className="preference-bar-container">
                          <div className="preference-bar-bg">
                            <div
                              className="preference-bar-fill"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                        <div className="preference-stats">
                          {count} ({percentage.toFixed(1)}%)
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Behavioral Insights */}
            <div className="behavioral-insights">
              <h4 className="insights-title">💡 Behavioral Insights</h4>
              <div className="insights-grid">
                <div className="insights-section">
                  <h5 className="insights-section-title">Timing Patterns:</h5>
                  <ul className="insights-list">
                    <li>Most active hour: {calculatePatterns.hourCounts.indexOf(Math.max(...calculatePatterns.hourCounts)).toString().padStart(2, '0')}:00</li>
                    <li>Consistency score: {contractInsights.consistency_score}/1000</li>
                    <li>Total sessions: {contractInsights.total_sessions.toString()}</li>
                  </ul>
                </div>
                <div className="insights-section">
                  <h5 className="insights-section-title">Risk Profile:</h5>
                  <ul className="insights-list">
                    <li>Risk score: {contractInsights.risk_score}/1000</li>
                    <li>Preferred token: {getTokenName(parseInt(Object.keys(calculatePatterns.tokenCounts)[0]))}</li>
                    <li>Amount range: {calculatePatterns.minAmount.toFixed(2)} - {calculatePatterns.maxAmount.toFixed(2)}</li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="no-patterns-data">
            <div className="no-data-icon">📊</div>
            <p className="no-data-message">No borrowing data available for the selected timeframe</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ==================== ACTIVITY VISUALIZATION COMPONENT ====================

const ActivityVisualization: React.FC<ActivityVisualizationProps> = ({ 
  activityPattern, 
  insights, 
  optimalTimes 
}) => {
  const [selectedView, setSelectedView] = useState<'activity' | 'optimal' | 'comparison'>('activity');

  const getHourLabel = (hour: number): string => {
    return hour.toString().padStart(2, '0') + ':00';
  };

  const getTimeOfDay = (hour: number): string => {
    if (hour >= 6 && hour < 12) return 'Morning';
    if (hour >= 12 && hour < 18) return 'Afternoon';
    if (hour >= 18 && hour < 22) return 'Evening';
    return 'Night';
  };

  const maxActivityValue = Math.max(...activityPattern.values);

  return (
    <div className="activity-visualization-card">
      <div className="visualization-header">
        <h3 className="visualization-title">
          📊 Activity & Optimization Analysis
        </h3>
        
        {/* View Selector */}
        <div className="view-selector">
          {(['activity', 'optimal', 'comparison'] as const).map((view) => (
            <button
              key={view}
              onClick={() => setSelectedView(view)}
              className={`view-button ${
                selectedView === view ? 'active' : 'inactive'
              }`}
            >
              {view.charAt(0).toUpperCase() + view.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="visualization-content">
        {/* Activity Pattern View */}
        {selectedView === 'activity' && (
          <div className="activity-pattern-section">
            <h4 className="activity-pattern-title">🌊 24-Hour Activity Pattern</h4>
            <div className="activity-chart-container">
              <div className="activity-bars">
                {activityPattern.values.map((value, hour) => (
                  <div key={hour} className="activity-bar">
                    <div
                      className="activity-bar-fill"
                      style={{ 
                        height: `${(value / maxActivityValue) * 100}%`,
                        minHeight: '2px'
                      }}
                      title={`${getHourLabel(hour)}: Activity ${value}`}
                    />
                  </div>
                ))}
              </div>
            </div>
            
            {/* Activity Stats */}
            <div className="activity-stats-grid">
              <div className="metric-card blue">
                <div className="metric-value">{insights.peak_activity_hour.toString().padStart(2, '0')}:00</div>
                <div className="metric-label">Peak Hour</div>
              </div>
              <div className="metric-card green">
                <div className="metric-value">{getTimeOfDay(insights.peak_activity_hour)}</div>
                <div className="metric-label">Peak Period</div>
              </div>
              <div className="metric-card purple">
                <div className="metric-value">{Math.max(...activityPattern.values)}</div>
                <div className="metric-label">Max Activity</div>
              </div>
              <div className="metric-card orange">
                <div className="metric-value">
                  {(activityPattern.values.reduce((a, b) => a + b, 0) / 24).toFixed(0)}
                </div>
                <div className="metric-label">Avg Activity</div>
              </div>
            </div>
          </div>
        )}

        {/* Optimal Times View */}
        {selectedView === 'optimal' && (
          <div className="optimal-times-section">
            <h4 className="optimal-times-title">⭐ Optimal Borrowing Times</h4>
            <div className="optimal-times-grid">
              {optimalTimes.optimal_hours.map((hour, index) => (
                <div key={hour} className="optimal-time-card">
                  <div className="optimal-time-icon">⏰</div>
                  <div className="optimal-time-hour">{getHourLabel(hour)}</div>
                  <div className="optimal-time-period">{getTimeOfDay(hour)}</div>
                  <div className="optimal-time-rate">
                    {(optimalTimes.rates[index] * 100).toFixed(2)}% rate
                  </div>
                </div>
              ))}
            </div>
            
            <div className="optimal-benefits">
              <h5 className="optimal-benefits-title">🎯 Why These Times Are Optimal</h5>
              <div className="optimal-benefits-grid">
                <div className="benefits-category">
                  <h6 className="benefits-category-title">Biological Factors:</h6>
                  <ul className="benefits-list">
                    <li>Peak cognitive performance</li>
                    <li>Best decision-making clarity</li>
                    <li>Optimal attention span</li>
                    <li>Reduced impulsivity</li>
                  </ul>
                </div>
                <div className="benefits-category">
                  <h6 className="benefits-category-title">Financial Benefits:</h6>
                  <ul className="benefits-list">
                    <li>Lower interest rates</li>
                    <li>Better risk assessment</li>
                    <li>Improved loan terms</li>
                    <li>Enhanced consistency bonus</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Comparison View */}
        {selectedView === 'comparison' && (
          <div className="comparison-section">
            <h4 className="comparison-title">🔄 Activity vs Optimal Times Comparison</h4>
            <div className="comparison-chart">
              <div className="comparison-bars">
                {activityPattern.values.map((value, hour) => {
                  const isOptimal = optimalTimes.optimal_hours.includes(hour);
                  const activityHeight = (value / maxActivityValue) * 80;
                  
                  return (
                    <div key={hour} className="comparison-bar">
                      <div className="comparison-bar-container">
                        <div
                          className={`comparison-bar-fill ${isOptimal ? 'optimal' : 'activity'}`}
                          style={{ height: `${activityHeight}px`, minHeight: '2px' }}
                          title={`${getHourLabel(hour)}: Activity ${value}${isOptimal ? ' (Optimal)' : ''}`}
                        />
                        {isOptimal && (
                          <div className="optimal-marker">
                            <div className="optimal-marker-dot" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="comparison-legend">
                <div className="legend-item">
                  <div className="legend-color activity" />
                  <span>Your Activity</span>
                </div>
                <div className="legend-item">
                  <div className="legend-color optimal" />
                  <span>Optimal Times</span>
                </div>
                <div className="legend-item">
                  <div className="legend-color opportunity" />
                  <span>Peak Opportunity</span>
                </div>
              </div>
            </div>

            {/* Alignment Analysis */}
            <div className="alignment-analysis">
              <h5 className="alignment-title">📊 Alignment Analysis</h5>
              <div className="alignment-stats">
                <div className="alignment-stat">
                  <div className="alignment-value">
                    {optimalTimes.optimal_hours.filter(hour => 
                      activityPattern.values[hour] > activityPattern.values.reduce((a, b) => a + b, 0) / 24
                    ).length}
                  </div>
                  <div className="alignment-label">Aligned Hours</div>
                </div>
                <div className="alignment-stat">
                  <div className="alignment-value">
                    {((optimalTimes.optimal_hours.filter(hour => 
                      activityPattern.values[hour] > activityPattern.values.reduce((a, b) => a + b, 0) / 24
                    ).length / optimalTimes.optimal_hours.length) * 100).toFixed(0)}%
                  </div>
                  <div className="alignment-label">Alignment Score</div>
                </div>
                <div className="alignment-stat">
                  <div className="alignment-value">
                    {5 - optimalTimes.optimal_hours.filter(hour => 
                      activityPattern.values[hour] > activityPattern.values.reduce((a, b) => a + b, 0) / 24
                    ).length}
                  </div>
                  <div className="alignment-label">Missed Opportunities</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ==================== PERFORMANCE METRICS COMPONENT ====================

const PerformanceMetrics: React.FC<PerformanceMetricsProps> = ({ 
  contractInsights, 
  rateComparisons, 
  userLoans 
}) => {
  const calculateSavings = useCallback((): number => {
    return rateComparisons.reduce((total, comparison) => {
      if (comparison.ml_beneficial) {
        return total + parseFloat(comparison.savings);
      }
      return total;
    }, 0);
  }, [rateComparisons]);

  const calculateAverageRateImprovement = useCallback((): number => {
    const improvements = rateComparisons
      .filter(comp => comp.ml_beneficial)
      .map(comp => parseFloat(comp.savings));
    
    return improvements.length > 0 
      ? improvements.reduce((sum, imp) => sum + imp, 0) / improvements.length 
      : 0;
  }, [rateComparisons]);

  const getPerformanceGrade = useCallback((): { grade: string; className: string; description: string } => {
    const consistency = contractInsights.consistency_score;
    const riskScore = contractInsights.risk_score;
    const mlConfidence = contractInsights.ml_confidence;
    
    const overallScore = (consistency + (1000 - riskScore) + mlConfidence) / 3;
    
    if (overallScore >= 800) return { 
      grade: 'A+', 
      className: 'performance-grade-excellent', 
      description: 'Excellent performance with optimal patterns' 
    };
    if (overallScore >= 700) return { 
      grade: 'A', 
      className: 'performance-grade-very-good', 
      description: 'Very good performance with strong patterns' 
    };
    if (overallScore >= 600) return { 
      grade: 'B+', 
      className: 'performance-grade-good', 
      description: 'Good performance with room for improvement' 
    };
    if (overallScore >= 500) return { 
      grade: 'B', 
      className: 'performance-grade-average', 
      description: 'Average performance, focus on consistency' 
    };
    return { 
      grade: 'C', 
      className: 'performance-grade-below-average', 
      description: 'Below average, significant improvement needed' 
    };
  }, [contractInsights]);

  const totalSavings = useMemo(() => calculateSavings(), [calculateSavings]);
  const avgImprovement = useMemo(() => calculateAverageRateImprovement(), [calculateAverageRateImprovement]);
  const performance = useMemo(() => getPerformanceGrade(), [getPerformanceGrade]);

  return (
    <div className="performance-metrics-card">
      <h3 className="metrics-title">
        🏆 Performance Metrics & Achievements
      </h3>

      <div className="metrics-content">
        {/* Overall Performance Grade */}
        <div className="performance-grade-display">
          <div className={`performance-grade ${performance.className}`}>
            {performance.grade}
          </div>
          <h4 className="performance-grade-title">Overall Performance</h4>
          <p className="performance-grade-description">{performance.description}</p>
        </div>

        {/* Key Metrics Grid */}
        <div className="key-metrics-grid">
          <div className="key-metric-card savings">
            <div className="key-metric-icon">💰</div>
            <div className="key-metric-value">
              {totalSavings > 0 ? totalSavings.toFixed(4) : '0.0000'}
            </div>
            <div className="key-metric-label">Total Savings (ETH)</div>
          </div>
          
          <div className="key-metric-card improvement">
            <div className="key-metric-icon">📈</div>
            <div className="key-metric-value">
              {(avgImprovement * 100).toFixed(2)}%
            </div>
            <div className="key-metric-label">Avg Rate Improvement</div>
          </div>
          
          <div className="key-metric-card consistency">
            <div className="key-metric-icon">🎯</div>
            <div className="key-metric-value">
              {contractInsights.consistency_score}
            </div>
            <div className="key-metric-label">Consistency Score</div>
          </div>
          
          <div className="key-metric-card sessions">
            <div className="key-metric-icon">🔥</div>
            <div className="key-metric-value">
              {contractInsights.total_sessions.toString()}
            </div>
            <div className="key-metric-label">Total Sessions</div>
          </div>
        </div>

        {/* Detailed Metrics */}
        <div className="detailed-metrics">
          {/* Financial Performance */}
          <div className="detailed-metric-section">
            <h5 className="detailed-metric-title">💸 Financial Performance</h5>
            <div className="detailed-metric-list">
              <div className="detailed-metric-item">
                <span className="detailed-metric-label">Beneficial ML Decisions:</span>
                <span className="detailed-metric-value">
                  {rateComparisons.filter(comp => comp.ml_beneficial).length} / {rateComparisons.length}
                </span>
              </div>
              <div className="detailed-metric-item">
                <span className="detailed-metric-label">Success Rate:</span>
                <span className="detailed-metric-value">
                  {rateComparisons.length > 0 
                    ? ((rateComparisons.filter(comp => comp.ml_beneficial).length / rateComparisons.length) * 100).toFixed(1)
                    : '0'
                  }%
                </span>
              </div>
              <div className="detailed-metric-item">
                <span className="detailed-metric-label">Risk Score:</span>
                <span className={`detailed-metric-value ${
                  contractInsights.risk_score < 300 ? 'low-risk' :
                  contractInsights.risk_score < 700 ? 'medium-risk' : 'high-risk'
                }`}>
                  {contractInsights.risk_score}/1000
                </span>
              </div>
            </div>
          </div>

          {/* Behavioral Metrics */}
          <div className="detailed-metric-section">
            <h5 className="detailed-metric-title">🧠 Behavioral Metrics</h5>
            <div className="detailed-metric-list">
              <div className="detailed-metric-item">
                <span className="detailed-metric-label">ML Confidence:</span>
                <span className="detailed-metric-value">{(contractInsights.ml_confidence / 10).toFixed(1)}%</span>
              </div>
              <div className="detailed-metric-item">
                <span className="detailed-metric-label">Current Alignment:</span>
                <span className="detailed-metric-value">{contractInsights.current_alignment}/1000</span>
              </div>
              <div className="detailed-metric-item">
                <span className="detailed-metric-label">Active Loans:</span>
                <span className="detailed-metric-value">{userLoans.filter(loan => loan.active).length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Achievement Badges */}
        <div className="achievements-section">
          <h5 className="achievements-title">🏅 Achievements</h5>
          <div className="achievements-grid">
            {contractInsights.consistency_score >= 800 && (
              <div className="achievement-badge consistency">
                <div className="achievement-icon">🌟</div>
                <div className="achievement-name">Consistency Master</div>
              </div>
            )}
            
            {contractInsights.total_sessions >= 10 && (
              <div className="achievement-badge veteran">
                <div className="achievement-icon">🎯</div>
                <div className="achievement-name">Veteran Borrower</div>
              </div>
            )}
            
            {totalSavings > 0.01 && (
              <div className="achievement-badge saver">
                <div className="achievement-icon">💰</div>
                <div className="achievement-name">Smart Saver</div>
              </div>
            )}
            
            {contractInsights.risk_score <= 300 && (
              <div className="achievement-badge low-risk">
                <div className="achievement-icon">🛡️</div>
                <div className="achievement-name">Low Risk</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== OPTIMIZATION TIPS COMPONENT ====================

const OptimizationTips: React.FC<OptimizationTipsProps> = ({ 
  prediction, 
  contractInsights, 
  optimalTimes 
}) => {
  const generatePersonalizedTips = useCallback((): Array<{ type: 'timing' | 'risk' | 'consistency' | 'ml'; tip: string; impact: 'high' | 'medium' | 'low' }> => {
    const tips = [];

    // Timing-based tips
    if (contractInsights.current_alignment < 800) {
      tips.push({
        type: 'timing' as const,
        tip: `Borrow during your optimal hours (${optimalTimes.optimal_hours.map(h => h.toString().padStart(2, '0') + ':00').join(', ')}) to get better rates and improve your alignment score.`,
        impact: 'high' as const
      });
    }

    // Risk-based tips
    if (contractInsights.risk_score > 700) {
      tips.push({
        type: 'risk' as const,
        tip: 'Your risk score is high. Focus on consistent repayment behavior and smaller loan amounts to improve your profile.',
        impact: 'high' as const
      });
    }

    // Consistency tips
    if (contractInsights.consistency_score < 600) {
      tips.push({
        type: 'consistency' as const,
        tip: 'Try to borrow at consistent times to improve your consistency score and unlock better rates.',
        impact: 'medium' as const
      });
    }

    // ML confidence tips
    if (contractInsights.ml_confidence < 700) {
      tips.push({
        type: 'ml' as const,
        tip: 'More borrowing sessions will improve ML prediction accuracy and potentially unlock better personalized rates.',
        impact: 'medium' as const
      });
    }

    // Chronotype-specific tips
    if (prediction.chronotype === 0) {
      tips.push({
        type: 'timing' as const,
        tip: 'As an early chronotype, you get the best rates between 6-10 AM. Avoid borrowing late at night for optimal terms.',
        impact: 'medium' as const
      });
    } else if (prediction.chronotype === 2) {
      tips.push({
        type: 'timing' as const,
        tip: 'Your late chronotype gives you advantages during evening hours (8 PM - 2 AM). Consider timing your financial decisions accordingly.',
        impact: 'medium' as const
      });
    }

    // General tips if score is good
    if (contractInsights.consistency_score >= 800 && contractInsights.risk_score <= 300) {
      tips.push({
        type: 'consistency' as const,
        tip: 'Excellent profile! You\'re already optimizing well. Consider exploring larger amounts or different token types.',
        impact: 'low' as const
      });
    }

    return tips;
  }, [prediction, contractInsights, optimalTimes]);

  const tips = useMemo(() => generatePersonalizedTips(), [generatePersonalizedTips]);

  const getTypeIcon = (type: string): string => {
    switch (type) {
      case 'timing': return '⏰';
      case 'risk': return '🛡️';
      case 'consistency': return '🎯';
      case 'ml': return '🧠';
      default: return '💡';
    }
  };

  return (
    <div className="optimization-tips-card">
      <h3 className="tips-title">
        💡 Personalized Optimization Tips
      </h3>

      <div className="tips-content">
        {tips.map((tip, index) => (
          <div
            key={index}
            className={`tip-item ${tip.impact}-impact`}
          >
            <div className="tip-content-row">
              <div className="tip-icon">{getTypeIcon(tip.type)}</div>
              <div className="tip-details">
                <div className="tip-header">
                  <span className="tip-type">{tip.type} Optimization</span>
                  <span className={`tip-impact-badge ${tip.impact}`}>
                    {tip.impact.toUpperCase()} IMPACT
                  </span>
                </div>
                <p className="tip-text">{tip.tip}</p>
              </div>
            </div>
          </div>
        ))}

        {/* Quick Action Items */}
        <div className="quick-actions">
          <h4 className="quick-actions-title">🚀 Quick Actions</h4>
          <div className="quick-actions-grid">
            <div className="quick-actions-section">
              <h5 className="quick-actions-section-title">Immediate (Today):</h5>
              <ul className="quick-actions-list">
                <li>Check your optimal borrowing hours</li>
                <li>Review your current risk score</li>
                <li>Plan your next borrowing session timing</li>
              </ul>
            </div>
            <div className="quick-actions-section">
              <h5 className="quick-actions-section-title">This Week:</h5>
              <ul className="quick-actions-list">
                <li>Implement consistent timing patterns</li>
                <li>Focus on smaller, regular loans</li>
                <li>Monitor your performance metrics</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Potential Savings Calculator */}
        <div className="potential-savings">
          <h4 className="potential-savings-title">💰 Potential Savings</h4>
          <div className="potential-savings-content">
            <p className="potential-savings-intro">
              By following these optimization tips, you could potentially:
            </p>
            <ul className="potential-savings-list">
              <li>Reduce interest rates by 5-20% through optimal timing</li>
              <li>Lower collateral requirements by up to 15% with better risk scores</li>
              <li>Unlock consistency bonuses of up to 5%</li>
              <li>Improve ML prediction accuracy for personalized rates</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== HISTORICAL ANALYSIS COMPONENT ====================

const HistoricalAnalysis: React.FC<HistoricalAnalysisProps> = ({ userLoans, tokens, contractInsights }) => {
  const [selectedMetric, setSelectedMetric] = useState<'performance' | 'trends' | 'patterns'>('performance');

  const analyzeHistoricalPerformance = useMemo(() => {
    if (userLoans.length === 0) return null;

    const sortedLoans = [...userLoans].sort((a, b) => a.issuanceTimestamp - b.issuanceTimestamp);
    
    // Performance over time
    const performanceData = sortedLoans.map((loan) => {
      const date = new Date(loan.issuanceTimestamp * 1000);
      const hour = date.getHours();
      const isOptimalTime = hour >= 9 && hour <= 17; // Simple optimal time range
      
      return {
        loanId: loan.id,
        date: date.toLocaleDateString(),
        hour,
        tokenType: loan.tokenType,
        amount: parseFloat(loan.tokenAmount),
        isOptimalTime,
        performance: isOptimalTime ? 'optimal' : 'suboptimal'
      };
    });

    // Trends
    const monthlyStats = performanceData.reduce((acc, loan) => {
      const monthKey = new Date(loan.date).toISOString().slice(0, 7);
      if (!acc[monthKey]) {
        acc[monthKey] = { total: 0, optimal: 0, amount: 0 };
      }
      acc[monthKey].total++;
      if (loan.isOptimalTime) acc[monthKey].optimal++;
      acc[monthKey].amount += loan.amount;
      return acc;
    }, {} as Record<string, { total: number; optimal: number; amount: number }>);

    return { performanceData, monthlyStats };
  }, [userLoans]);

  return (
    <div className="historical-analysis-card">
      <div className="historical-header">
        <h3 className="historical-title">
          📊 Historical Analysis
        </h3>
        
        {/* Metric Selector */}
        <div className="metric-selector">
          {(['performance', 'trends', 'patterns'] as const).map((metric) => (
            <button
              key={metric}
              onClick={() => setSelectedMetric(metric)}
              className={`metric-button ${
                selectedMetric === metric ? 'active' : 'inactive'
              }`}
            >
              {metric.charAt(0).toUpperCase() + metric.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="historical-content">
        {analyzeHistoricalPerformance ? (
          <>
            {/* Performance Analysis */}
            {selectedMetric === 'performance' && (
              <div className="performance-analysis">
                <h4 className="performance-analysis-title">🏆 Performance Over Time</h4>
                <div className="performance-overview">
                  <div className="performance-stats">
                    <div className="performance-stat">
                      <div className="performance-stat-value">
                        {analyzeHistoricalPerformance.performanceData.length}
                      </div>
                      <div className="performance-stat-label">Total Loans</div>
                    </div>
                    <div className="performance-stat">
                      <div className="performance-stat-value">
                        {analyzeHistoricalPerformance.performanceData.filter(loan => loan.isOptimalTime).length}
                      </div>
                      <div className="performance-stat-label">Optimal Timing</div>
                    </div>
                    <div className="performance-stat">
                      <div className="performance-stat-value">
                        {((analyzeHistoricalPerformance.performanceData.filter(loan => loan.isOptimalTime).length / 
                           analyzeHistoricalPerformance.performanceData.length) * 100).toFixed(1)}%
                      </div>
                      <div className="performance-stat-label">Success Rate</div>
                    </div>
                  </div>

                  {/* Recent Activity */}
                  <div className="recent-activity">
                    <h5 className="recent-activity-title">Recent Activity:</h5>
                    {analyzeHistoricalPerformance.performanceData.slice(-5).map((loan) => (
                      <div key={loan.loanId} className="activity-item">
                        <div className="activity-item-left">
                          <div className={`activity-status-dot ${
                            loan.isOptimalTime ? 'optimal' : 'suboptimal'
                          }`} />
                          <span className="activity-time">
                            {loan.date} at {loan.hour.toString().padStart(2, '0')}:00
                          </span>
                        </div>
                        <div className="activity-amount">
                          {loan.amount.toFixed(2)} {tokens.find(t => t.type === loan.tokenType)?.name.split(' ')[0]}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Trends Analysis */}
            {selectedMetric === 'trends' && (
              <div className="trends-analysis">
                <h4 className="trends-analysis-title">📈 Trends & Progress</h4>
                {Object.entries(analyzeHistoricalPerformance.monthlyStats).map(([month, stats]) => (
                  <div key={month} className="trend-item">
                    <div className="trend-item-header">
                      <h5 className="trend-month">{month}</h5>
                      <div className="trend-stats">
                        {stats.optimal}/{stats.total} optimal ({((stats.optimal/stats.total)*100).toFixed(1)}%)
                      </div>
                    </div>
                    <div className="trend-progress-bar">
                      <div
                        className="trend-progress-fill"
                        style={{ width: `${(stats.optimal/stats.total)*100}%` }}
                      />
                    </div>
                    <div className="trend-amount">
                      Total amount: {stats.amount.toFixed(2)} tokens
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Patterns Analysis */}
            {selectedMetric === 'patterns' && (
              <div className="patterns-analysis">
                <h4 className="patterns-analysis-title">🔍 Behavioral Patterns</h4>
                <div className="patterns-grid">
                  {/* Hour Distribution */}
                  <div className="patterns-section">
                    <h5 className="patterns-section-title">Time Preferences</h5>
                    <div className="patterns-list">
                      {[
                        { label: 'Morning (6-12)', count: analyzeHistoricalPerformance.performanceData.filter(l => l.hour >= 6 && l.hour < 12).length },
                        { label: 'Afternoon (12-18)', count: analyzeHistoricalPerformance.performanceData.filter(l => l.hour >= 12 && l.hour < 18).length },
                        { label: 'Evening (18-24)', count: analyzeHistoricalPerformance.performanceData.filter(l => l.hour >= 18 || l.hour < 6).length },
                      ].map((period) => (
                        <div key={period.label} className="pattern-item">
                          <span className="pattern-label">{period.label}:</span>
                          <span className="pattern-value">{period.count} loans</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Token Preferences */}
                  <div className="patterns-section">
                    <h5 className="patterns-section-title">Token Preferences</h5>
                    <div className="patterns-list">
                      {tokens.map((token) => {
                        const count = analyzeHistoricalPerformance.performanceData.filter(l => l.tokenType === token.type).length;
                        return count > 0 ? (
                          <div key={token.type} className="pattern-item">
                            <span className="pattern-label">{token.name.split(' ')[0]}:</span>
                            <span className="pattern-value">{count} loans</span>
                          </div>
                        ) : null;
                      })}
                    </div>
                  </div>
                </div>

                {/* Profile Evolution */}
                <div className="profile-evolution">
                  <h5 className="profile-evolution-title">📊 Profile Evolution</h5>
                  <div className="evolution-stats">
                    <div className="evolution-stat">
                      <div className="evolution-stat-label">Consistency Growth:</div>
                      <div className="evolution-stat-value">Score: {contractInsights.consistency_score}/1000</div>
                    </div>
                    <div className="evolution-stat">
                      <div className="evolution-stat-label">Risk Improvement:</div>
                      <div className="evolution-stat-value">Score: {contractInsights.risk_score}/1000</div>
                    </div>
                    <div className="evolution-stat">
                      <div className="evolution-stat-label">ML Confidence:</div>
                      <div className="evolution-stat-value">{(contractInsights.ml_confidence / 10).toFixed(1)}%</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="no-historical-data">
            <div className="no-historical-icon">📈</div>
            <p className="no-historical-message">No historical data available yet</p>
            <p className="no-historical-hint">Complete some loans to see your analytics</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ==================== MAIN ANALYTICS COMPONENT ====================

const ChronotypeAnalytics: React.FC = () => {
  const [state, setState] = useState<AnalyticsState>({
    isLoading: false,
    userAddress: null,
    contractInsights: null,
    mlPrediction: null,
    mlInsights: null,
    optimalTimes: null,
    userLoans: [],
    tokens: [],
    rateComparisons: [],
    activityPattern: null,
    analytics: null,
    error: null,
    lastUpdate: 0
  });

  // Initialize component and load all data
  useEffect(() => {
    const initializeAnalytics = async () => {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        console.log('Initializing Chronotype Analytics...');

        // Initialize contract service
        if (!contractService.isInitialized) {
          await contractService.init();
        }

        // Get user address
        let userAddress: string | null = null;
        try {
          if (contractService.signer) {
            userAddress = await contractService.signer.getAddress();
            console.log('Analytics connected to user:', userAddress);
          }
        } catch (error) {
          console.warn('Could not get user address:', error);
        }

        if (!userAddress) {
          setState(prev => ({
            ...prev,
            isLoading: false,
            error: 'Please connect your wallet to view analytics'
          }));
          return;
        }

        // Load all data in parallel
        console.log('Loading analytics data...');
        const [
          tokens,
          userLoans,
          analytics
        ] = await Promise.all([
          contractService.getTokenDetails(),
          contractService.getUserLoans(userAddress),
          mlService.getAnalytics()
        ]);

        // Load contract insights and optimal times with fallbacks
        let contractInsights: UserMLInsights | null = null;
        let optimalTimes: OptimalBorrowingTimes | null = null;

        try {
          contractInsights = await contractService.getUserMLCircadianInsights(userAddress);
        } catch (error) {
          console.warn('Could not get contract insights (normal if no loans):', error);
        }

        try {
          optimalTimes = await contractService.getOptimalBorrowingTimes(userAddress);
        } catch (error) {
          console.warn('Could not get optimal times (normal if no loans):', error);
        }

        // Generate activity pattern and get ML insights
        const activityPattern = mlService.generateSampleActivityPattern('intermediate');
        console.log('Generated activity pattern for analytics:', activityPattern);

        const [mlPrediction, mlInsights] = await Promise.all([
          mlService.predictChronotype(activityPattern.values, false),
          mlService.getUserInsights(activityPattern.values, false)
        ]);

        console.log('ML Prediction:', mlPrediction);
        console.log('ML Insights:', mlInsights);

        // Get rate comparisons for all tokens
        const rateComparisons = await Promise.all(
          tokens.map(token => 
            contractService.compareRateCalculations(userAddress!, token.type, '0.1')
              .catch(() => ({ traditional_rate: '0', ml_enhanced_rate: '0', savings: '0', ml_beneficial: false }))
          )
        );

        setState(prev => ({
          ...prev,
          isLoading: false,
          userAddress,
          contractInsights,
          mlPrediction,
          mlInsights,
          optimalTimes,
          userLoans,
          tokens,
          rateComparisons,
          activityPattern,
          analytics,
          lastUpdate: Date.now()
        }));

        console.log('Analytics initialization completed');

      } catch (error) {
        console.error('Failed to initialize analytics:', error);
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to load analytics data'
        }));
      }
    };

    initializeAnalytics();
  }, []);

  // Refresh data function
  const refreshData = useCallback(async () => {
    if (!state.userAddress) return;
    
    console.log('Refreshing analytics data...');
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const [contractInsights, userLoans, optimalTimes] = await Promise.all([
        contractService.getUserMLCircadianInsights(state.userAddress).catch(() => null),
        contractService.getUserLoans(state.userAddress),
        contractService.getOptimalBorrowingTimes(state.userAddress).catch(() => null)
      ]);

      setState(prev => ({
        ...prev,
        isLoading: false,
        contractInsights,
        userLoans,
        optimalTimes,
        lastUpdate: Date.now()
      }));

      console.log('Analytics data refreshed');
    } catch (error) {
      console.error('Failed to refresh data:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [state.userAddress]);

  return (
    <div className="chronotype-analytics">
      <div className="analytics-container">
        {/* Header */}
        <div className="analytics-header">
          <h1 className="analytics-title">
            🧬 Chronotype Analytics Dashboard
          </h1>
          <p className="analytics-subtitle">
            Comprehensive analysis of your borrowing patterns and optimization insights
          </p>
          {state.userAddress && (
            <div className="user-connection-info">
              <p className="user-address-info">
                Connected: {state.userAddress.slice(0, 6)}...{state.userAddress.slice(-4)}
              </p>
              <button
                onClick={refreshData}
                className="refresh-data-button"
              >
                Refresh Data
              </button>
            </div>
          )}
        </div>

        {/* Error State */}
        {state.error && (
          <div className="analytics-error">
            <div className="analytics-error-content">
              <span className="analytics-error-icon">⚠️</span>
              <div className="analytics-error-details">
                <h3 className="analytics-error-title">Analytics Error</h3>
                <p className="analytics-error-message">{state.error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {state.isLoading && (
          <div className="analytics-loading">
            <div className="analytics-loading-spinner"></div>
            <h3 className="analytics-loading-title">
              Loading Analytics Data...
            </h3>
            <p className="analytics-loading-description">
              Gathering your borrowing patterns and ML insights
            </p>
          </div>
        )}

        {/* Analytics Content */}
        {!state.isLoading && !state.error && state.contractInsights && state.mlPrediction && state.mlInsights && (
          <>
            {/* Chronotype Overview */}
            <ChronotypeOverview
              prediction={state.mlPrediction}
              insights={state.mlInsights}
              contractInsights={state.contractInsights}
            />

            {/* Behavior Patterns */}
            <BehaviorPatterns
              userLoans={state.userLoans}
              contractInsights={state.contractInsights}
              tokens={state.tokens}
            />

            {/* Activity Visualization */}
            {state.activityPattern && state.optimalTimes && (
              <ActivityVisualization
                activityPattern={state.activityPattern}
                insights={state.mlInsights}
                optimalTimes={state.optimalTimes}
              />
            )}

            {/* Performance Metrics */}
            <PerformanceMetrics
              contractInsights={state.contractInsights}
              rateComparisons={state.rateComparisons}
              userLoans={state.userLoans}
            />

            {/* Optimization Tips */}
            {state.optimalTimes && (
              <OptimizationTips
                prediction={state.mlPrediction}
                contractInsights={state.contractInsights}
                optimalTimes={state.optimalTimes}
              />
            )}

            {/* Historical Analysis */}
            <HistoricalAnalysis
              userLoans={state.userLoans}
              tokens={state.tokens}
              contractInsights={state.contractInsights}
            />
          </>
        )}

        {/* No Data State */}
        {!state.isLoading && !state.error && (!state.contractInsights || state.contractInsights.total_sessions === 0) && (
          <div className="analytics-no-data">
            <div className="no-data-journey-icon">📊</div>
            <h3 className="no-data-journey-title">
              Start Your Analytics Journey
            </h3>
            <p className="no-data-journey-description">
              Complete your first loan to unlock comprehensive chronotype analytics, 
              personalized insights, and optimization recommendations.
            </p>
            <div className="no-data-features">
              <div className="no-data-feature">
                <div className="no-data-feature-icon">🧬</div>
                <h4 className="no-data-feature-title">Chronotype Detection</h4>
                <p className="no-data-feature-description">
                  Discover your optimal borrowing times with ML analysis
                </p>
              </div>
              <div className="no-data-feature">
                <div className="no-data-feature-icon">📈</div>
                <h4 className="no-data-feature-title">Performance Tracking</h4>
                <p className="no-data-feature-description">
                  Monitor your borrowing patterns and optimization progress
                </p>
              </div>
              <div className="no-data-feature">
                <div className="no-data-feature-icon">💡</div>
                <h4 className="no-data-feature-title">Smart Recommendations</h4>
                <p className="no-data-feature-description">
                  Get personalized tips to improve your lending experience
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Last Update Info */}
        {state.lastUpdate > 0 && (
          <div className="last-update-info">
            Last updated: {new Date(state.lastUpdate).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChronotypeAnalytics;
