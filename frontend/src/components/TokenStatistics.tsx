// src/components/TokenStatistics.tsx
import { useState, useEffect } from 'react';
import contractService, { TokenStatistics as TokenStatsType } from '../services/ContractService';
import './TokenStatistics.css';

const TokenStatistics = () => {
  const [stats, setStats] = useState<TokenStatsType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load token statistics
  useEffect(() => {
    loadTokenStats();
    
    // Refresh statistics every 60 seconds
    const intervalId = setInterval(loadTokenStats, 60000);
    
    return () => clearInterval(intervalId);
  }, []);

  const loadTokenStats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const tokenStats = await contractService.getTokenStatistics();
      setStats(tokenStats);
      
      setLoading(false);
    } catch (err) {
      console.error('Failed to load token statistics:', err);
      setError(`Failed to load token statistics: ${err instanceof Error ? err.message : String(err)}`);
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="token-statistics loading">Loading protocol statistics...</div>;
  }

  if (error) {
    return (
      <div className="token-statistics">
        <h2>Protocol Statistics</h2>
        <div className="error-message">{error}</div>
        <button className="refresh-button" onClick={loadTokenStats}>
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="token-statistics">
      <div className="statistics-header">
        <h2>Protocol Statistics</h2>
        <button className="refresh-button" onClick={loadTokenStats} title="Refresh statistics">
          🔄 Refresh
        </button>
      </div>
      
      <div className="statistics-grid">
        {stats.map((stat) => (
          <div key={stat.tokenType} className="statistics-card">
            <h3>{stat.tokenName}</h3>
            
            <div className="statistics-details">
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
              
              <div className="utilization-container">
                <div className="utilization-label">
                  <span>Utilization Rate:</span>
                  <span>{stat.utilizationRate.toFixed(2)}%</span>
                </div>
                <div className="utilization-bar">
                  <div 
                    className="utilization-fill" 
                    style={{ width: `${Math.min(100, stat.utilizationRate)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TokenStatistics;
