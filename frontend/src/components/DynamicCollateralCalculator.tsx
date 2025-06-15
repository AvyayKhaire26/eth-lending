/**
 * DynamicCollateralCalculator.tsx
 * Interactive calculator for dynamic collateral requirements
 * Shows real-time calculations based on token type, user risk, and ML chronotype
 */

import React, { useState, useEffect, useCallback } from 'react';
import contractService, { 
  TokenInfo, 
  BorrowingTerms, 
  UserMLInsights,
  RateComparison 
} from '../services/ContractService';
import mlService, { 
  ChronotypePrediction 
} from '../services/MLService';

// ==================== INTERFACES ====================

interface CollateralCalculation {
  baseCollateral: number;
  dynamicCollateral: number;
  staticCollateral: number;
  collateralSavings: number;
  riskMultipliers: {
    tokenMultiplier: number;
    chronotypeMultiplier: number;
    riskScoreMultiplier: number;
    totalMultiplier: number;
  };
  recommendation: 'excellent' | 'good' | 'fair' | 'poor';
}

interface CalculatorState {
  isLoading: boolean;
  tokens: TokenInfo[];
  selectedToken: number;
  borrowAmount: string;
  userAddress: string | null;
  calculation: CollateralCalculation | null;
  borrowingTerms: BorrowingTerms | null;
  rateComparison: RateComparison | null;
  userInsights: UserMLInsights | null;
  mlPrediction: ChronotypePrediction | null;
  error: string | null;
  lastUpdate: number;
}

interface TokenSelectorProps {
  tokens: TokenInfo[];
  selectedToken: number;
  onTokenChange: (tokenType: number) => void;
}

interface AmountInputProps {
  amount: string;
  onAmountChange: (amount: string) => void;
  selectedToken: number;
  tokens: TokenInfo[];
}

interface CollateralBreakdownProps {
  calculation: CollateralCalculation;
  borrowingTerms: BorrowingTerms;
  selectedToken: number;
  tokens: TokenInfo[];
}

interface RiskFactorsProps {
  calculation: CollateralCalculation;
  userInsights: UserMLInsights | null;
  mlPrediction: ChronotypePrediction | null;
}

interface ComparisonViewProps {
  calculation: CollateralCalculation;
  rateComparison: RateComparison | null;
  borrowAmount: string;
}

// ==================== TOKEN SELECTOR COMPONENT ====================

const TokenSelector: React.FC<TokenSelectorProps> = ({ tokens, selectedToken, onTokenChange }) => {
  const getTokenIcon = (tokenType: number): string => {
    const icons = ['🟢', '🔵', '🟡', '🔴']; // Green, Blue, Yellow, Red
    return icons[tokenType] || '⚪';
  };

  const getRiskLevel = (rate: number): string => {
    if (rate <= 5) return 'Low Risk';
    if (rate <= 8) return 'Medium Risk';
    if (rate <= 12) return 'High Risk';
    return 'Very High Risk';
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
      <h3 className="text-xl font-semibold text-gray-800 mb-4">
        🎯 Select Token Type
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {tokens.map((token) => (
          <button
            key={token.type}
            onClick={() => onTokenChange(token.type)}
            className={`p-4 rounded-lg border-2 transition-all duration-200 ${
              selectedToken === token.type
                ? 'border-blue-500 bg-blue-50 shadow-md'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
            }`}
          >
            <div className="text-center">
              <div className="text-3xl mb-2">{getTokenIcon(token.type)}</div>
              <h4 className="font-semibold text-gray-800 mb-1">{token.name}</h4>
              <div className="text-sm space-y-1">
                <div className="text-green-600 font-medium">
                  {token.rate}% APR
                </div>
                <div className="text-gray-600">
                  {parseFloat(token.value).toFixed(2)} ETH
                </div>
                <div className={`text-xs px-2 py-1 rounded ${
                  token.rate <= 5 ? 'bg-green-100 text-green-700' :
                  token.rate <= 8 ? 'bg-yellow-100 text-yellow-700' :
                  token.rate <= 12 ? 'bg-orange-100 text-orange-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {getRiskLevel(token.rate)}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

// ==================== AMOUNT INPUT COMPONENT ====================

const AmountInput: React.FC<AmountInputProps> = ({ amount, onAmountChange, selectedToken, tokens }) => {
  const [localAmount, setLocalAmount] = useState(amount);
  const [isValid, setIsValid] = useState(true);

  const selectedTokenInfo = tokens.find(t => t.type === selectedToken);

  useEffect(() => {
    setLocalAmount(amount);
  }, [amount]);

  const handleAmountChange = useCallback((value: string) => {
    setLocalAmount(value);
    
    // Validate amount
    const numValue = parseFloat(value);
    const valid = !isNaN(numValue) && numValue > 0 && numValue <= 1000;
    setIsValid(valid);
    
    if (valid) {
      onAmountChange(value);
    }
  }, [onAmountChange]);

  const setPresetAmount = useCallback((preset: number) => {
    const newAmount = preset.toString();
    setLocalAmount(newAmount);
    setIsValid(true);
    onAmountChange(newAmount);
  }, [onAmountChange]);

  const calculateCollateralValue = useCallback((tokenAmount: string): string => {
    if (!selectedTokenInfo || !tokenAmount || isNaN(parseFloat(tokenAmount))) {
      return '0.00';
    }
    
    const amount = parseFloat(tokenAmount);
    const tokenValue = parseFloat(selectedTokenInfo.value);
    const borrowValue = amount * tokenValue;
    const staticCollateral = borrowValue * 1.5; // 150% static requirement
    
    return staticCollateral.toFixed(3);
  }, [selectedTokenInfo]);

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
      <h3 className="text-xl font-semibold text-gray-800 mb-4">
        💰 Borrowing Amount
      </h3>
      
      <div className="space-y-4">
        {/* Amount Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Amount to Borrow:
          </label>
          <div className="relative">
            <input
              type="number"
              value={localAmount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="0.00"
              step="0.01"
              min="0"
              max="1000"
              className={`w-full px-4 py-3 pr-20 text-lg border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                isValid ? 'border-gray-300' : 'border-red-300 bg-red-50'
              }`}
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500">
              {selectedTokenInfo?.name.split(' ')[0] || 'Tokens'}
            </div>
          </div>
          {!isValid && (
            <p className="mt-1 text-sm text-red-600">
              Please enter a valid amount between 0.01 and 1000
            </p>
          )}
        </div>

        {/* Preset Amounts */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Quick Select:
          </label>
          <div className="grid grid-cols-4 gap-2">
            {[0.1, 0.5, 1.0, 5.0].map((preset) => (
              <button
                key={preset}
                onClick={() => setPresetAmount(preset)}
                className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
              >
                {preset} {selectedTokenInfo?.name.split(' ')[0] || 'Tokens'}
              </button>
            ))}
          </div>
        </div>

        {/* Value Display */}
        {selectedTokenInfo && localAmount && !isNaN(parseFloat(localAmount)) && (
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-blue-600">Token Value:</span>
                <div className="font-bold text-blue-800">
                  {(parseFloat(localAmount) * parseFloat(selectedTokenInfo.value)).toFixed(4)} ETH
                </div>
              </div>
              <div>
                <span className="text-blue-600">Min Collateral (150%):</span>
                <div className="font-bold text-blue-800">
                  {calculateCollateralValue(localAmount)} ETH
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ==================== COLLATERAL BREAKDOWN COMPONENT ====================

const CollateralBreakdown: React.FC<CollateralBreakdownProps> = ({ 
  calculation, 
  borrowingTerms 
}) => {
  const getRecommendationColor = (recommendation: string): string => {
    switch (recommendation) {
      case 'excellent': return 'text-green-600 bg-green-50 border-green-200';
      case 'good': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'fair': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'poor': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getRecommendationIcon = (recommendation: string): string => {
    switch (recommendation) {
      case 'excellent': return '🌟';
      case 'good': return '👍';
      case 'fair': return '⚠️';
      case 'poor': return '❌';
      default: return '❓';
    }
  };

  const getRecommendationText = (recommendation: string): string => {
    switch (recommendation) {
      case 'excellent': return 'Excellent terms! Low risk profile with optimal timing.';
      case 'good': return 'Good terms. Reasonable risk with decent rates.';
      case 'fair': return 'Fair terms. Consider timing optimization.';
      case 'poor': return 'High risk. Consider reducing amount or waiting for better timing.';
      default: return 'Terms analysis unavailable.';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
      <h3 className="text-xl font-semibold text-gray-800 mb-4">
        📊 Collateral Breakdown
      </h3>

      <div className="space-y-6">
        {/* Main Comparison */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Static Collateral */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-semibold text-gray-700 mb-2">📏 Static Collateral (150%)</h4>
            <div className="text-2xl font-bold text-gray-800 mb-1">
              {calculation.staticCollateral.toFixed(4)} ETH
            </div>
            <p className="text-sm text-gray-600">
              Traditional fixed requirement
            </p>
          </div>

          {/* Dynamic Collateral */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-semibold text-blue-700 mb-2">🎯 Dynamic Collateral</h4>
            <div className="text-2xl font-bold text-blue-800 mb-1">
              {calculation.dynamicCollateral.toFixed(4)} ETH
            </div>
            <div className="flex items-center text-sm">
              {calculation.collateralSavings > 0 ? (
                <span className="text-green-600 font-medium">
                  ↓ Save {calculation.collateralSavings.toFixed(4)} ETH
                </span>
              ) : (
                <span className="text-red-600 font-medium">
                  ↑ Extra {Math.abs(calculation.collateralSavings).toFixed(4)} ETH
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Risk Multipliers Breakdown */}
        <div>
          <h4 className="font-semibold text-gray-700 mb-3">🔍 Risk Factor Analysis</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-sm text-purple-600 mb-1">Token Risk</div>
              <div className="font-bold text-purple-800">
                {((calculation.riskMultipliers.tokenMultiplier - 10000) / 100).toFixed(1)}%
              </div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-sm text-green-600 mb-1">Chronotype</div>
              <div className="font-bold text-green-800">
                {((calculation.riskMultipliers.chronotypeMultiplier - 10000) / 100).toFixed(1)}%
              </div>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <div className="text-sm text-orange-600 mb-1">Risk Score</div>
              <div className="font-bold text-orange-800">
                {((calculation.riskMultipliers.riskScoreMultiplier - 10000) / 100).toFixed(1)}%
              </div>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-sm text-blue-600 mb-1">Total</div>
              <div className="font-bold text-blue-800">
                {((calculation.riskMultipliers.totalMultiplier - 10000) / 100).toFixed(1)}%
              </div>
            </div>
          </div>
        </div>

        {/* Borrowing Terms */}
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-lg">
          <h4 className="font-semibold text-indigo-700 mb-3">📋 Complete Borrowing Terms</h4>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-indigo-600">Required Collateral:</span>
              <div className="font-bold text-indigo-800">
                {parseFloat(borrowingTerms.required_collateral).toFixed(4)} ETH
              </div>
            </div>
            <div>
              <span className="text-indigo-600">Interest Rate:</span>
              <div className="font-bold text-indigo-800">
                {(parseFloat(borrowingTerms.interest_rate) * 100).toFixed(3)}%
              </div>
            </div>
            <div>
              <span className="text-indigo-600">Risk Score:</span>
              <div className="font-bold text-indigo-800">
                {borrowingTerms.risk_score}/1000
              </div>
            </div>
          </div>
        </div>

        {/* Recommendation */}
        <div className={`p-4 rounded-lg border-2 ${getRecommendationColor(calculation.recommendation)}`}>
          <div className="flex items-center mb-2">
            <span className="text-2xl mr-2">{getRecommendationIcon(calculation.recommendation)}</span>
            <h4 className="font-semibold capitalize">{calculation.recommendation} Terms</h4>
          </div>
          <p className="text-sm">{getRecommendationText(calculation.recommendation)}</p>
        </div>
      </div>
    </div>
  );
};

// ==================== RISK FACTORS COMPONENT ====================

const RiskFactors: React.FC<RiskFactorsProps> = ({ calculation, userInsights, mlPrediction }) => {
  const getChronotypeIcon = (chronotype: number): string => {
    switch (chronotype) {
      case 0: return '🌅';
      case 2: return '🌙';
      default: return '☀️';
    }
  };

  const getRiskScoreColor = (score: number): string => {
    if (score < 300) return 'text-green-600';
    if (score < 700) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getRiskScoreLabel = (score: number): string => {
    if (score < 300) return 'Low Risk';
    if (score < 700) return 'Medium Risk';
    return 'High Risk';
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
      <h3 className="text-xl font-semibold text-gray-800 mb-4">
        🎯 Risk Profile Analysis
      </h3>

      <div className="grid md:grid-cols-2 gap-6">
        {/* User Risk Profile */}
        <div className="space-y-4">
          <h4 className="font-semibold text-gray-700">👤 Your Profile</h4>
          
          {userInsights ? (
            <div className="space-y-3">
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-blue-600">Total Sessions:</span>
                  <span className="font-bold text-blue-800">
                    {userInsights.total_sessions.toString()}
                  </span>
                </div>
              </div>
              
              <div className="bg-purple-50 p-3 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-purple-600">Consistency Score:</span>
                  <span className="font-bold text-purple-800">
                    {userInsights.consistency_score.toString()}/1000
                  </span>
                </div>
              </div>
              
              <div className="bg-orange-50 p-3 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-orange-600">Risk Score:</span>
                  <span className={`font-bold ${getRiskScoreColor(userInsights.risk_score)}`}>
                    {userInsights.risk_score.toString()}/1000 ({getRiskScoreLabel(userInsights.risk_score)})
                  </span>
                </div>
              </div>

              {mlPrediction && mlPrediction.success && (
                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-green-600">Chronotype:</span>
                    <span className="font-bold text-green-800">
                      {getChronotypeIcon(mlPrediction.chronotype)} {mlPrediction.chronotype_name}
                    </span>
                  </div>
                  <div className="text-xs text-green-600 mt-1">
                    Confidence: {(mlPrediction.confidence / 10).toFixed(1)}%
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center p-6 bg-gray-50 rounded-lg">
              <div className="text-gray-400 text-lg mb-2">📊</div>
              <p className="text-gray-600 text-sm">
                Connect wallet to see your lending history and risk profile
              </p>
            </div>
          )}
        </div>

        {/* Risk Impact Explanation */}
        <div className="space-y-4">
          <h4 className="font-semibold text-gray-700">📈 Risk Impact</h4>
          
          <div className="space-y-3">
            <div className="border-l-4 border-purple-400 pl-3">
              <h5 className="font-medium text-purple-700">Token Risk Factor</h5>
              <p className="text-sm text-gray-600">
                Higher-value tokens require more collateral due to increased volatility risk.
              </p>
              <div className="text-sm font-medium text-purple-600">
                Current: {((calculation.riskMultipliers.tokenMultiplier - 10000) / 100).toFixed(1)}%
              </div>
            </div>
            
            <div className="border-l-4 border-green-400 pl-3">
              <h5 className="font-medium text-green-700">Chronotype Bonus/Penalty</h5>
              <p className="text-sm text-gray-600">
                Early chronotypes get bonuses for better decision-making patterns.
              </p>
              <div className="text-sm font-medium text-green-600">
                Current: {((calculation.riskMultipliers.chronotypeMultiplier - 10000) / 100).toFixed(1)}%
              </div>
            </div>
            
            <div className="border-l-4 border-orange-400 pl-3">
              <h5 className="font-medium text-orange-700">Behavioral Risk</h5>
              <p className="text-sm text-gray-600">
                Your lending history and consistency affect collateral requirements.
              </p>
              <div className="text-sm font-medium text-orange-600">
                Current: {((calculation.riskMultipliers.riskScoreMultiplier - 10000) / 100).toFixed(1)}%
              </div>
            </div>
          </div>

          <div className="bg-blue-50 p-3 rounded-lg">
            <h5 className="font-medium text-blue-700 mb-1">💡 Improvement Tips</h5>
            <ul className="text-sm text-blue-600 space-y-1">
              <li>• Maintain consistent borrowing patterns</li>
              <li>• Repay loans on time or early</li>
              <li>• Borrow during your optimal chronotype hours</li>
              <li>• Start with lower-risk tokens to build history</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== COMPARISON VIEW COMPONENT ====================

const ComparisonView: React.FC<ComparisonViewProps> = ({ 
  calculation, 
  rateComparison, 
  borrowAmount 
}) => {
  const calculateTotalCost = useCallback((collateral: number, rate: string): number => {
    const interestCost = parseFloat(borrowAmount) * (parseFloat(rate) / 100);
    return collateral + interestCost;
  }, [borrowAmount]);

  const staticTotalCost = calculateTotalCost(calculation.staticCollateral, rateComparison?.traditional_rate || '0');
  const dynamicTotalCost = calculateTotalCost(calculation.dynamicCollateral, rateComparison?.ml_enhanced_rate || '0');
  const totalSavings = staticTotalCost - dynamicTotalCost;

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
      <h3 className="text-xl font-semibold text-gray-800 mb-4">
        ⚖️ Static vs Dynamic Comparison
      </h3>

      <div className="space-y-6">
        {/* Side-by-Side Comparison */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Static System */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-semibold text-gray-700 mb-3 flex items-center">
              <span className="mr-2">📏</span>
              Traditional Static System
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Collateral Requirement:</span>
                <span className="font-bold">{calculation.staticCollateral.toFixed(4)} ETH</span>
              </div>
              {rateComparison && (
                <div className="flex justify-between">
                  <span>Interest Rate:</span>
                  <span className="font-bold">{(parseFloat(rateComparison.traditional_rate) * 100).toFixed(3)}%</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Risk Assessment:</span>
                <span className="font-bold text-gray-600">Basic</span>
              </div>
              <hr className="my-2" />
              <div className="flex justify-between font-bold">
                <span>Total Cost:</span>
                <span>{staticTotalCost.toFixed(4)} ETH</span>
              </div>
            </div>
          </div>

          {/* Dynamic System */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-semibold text-blue-700 mb-3 flex items-center">
              <span className="mr-2">🎯</span>
              Enhanced Dynamic System
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Collateral Requirement:</span>
                <span className="font-bold">{calculation.dynamicCollateral.toFixed(4)} ETH</span>
              </div>
              {rateComparison && (
                <div className="flex justify-between">
                  <span>Interest Rate:</span>
                  <span className="font-bold">{(parseFloat(rateComparison.ml_enhanced_rate) * 100).toFixed(3)}%</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Risk Assessment:</span>
                <span className="font-bold text-blue-600">ML-Enhanced</span>
              </div>
              <hr className="my-2" />
              <div className="flex justify-between font-bold">
                <span>Total Cost:</span>
                <span>{dynamicTotalCost.toFixed(4)} ETH</span>
              </div>
            </div>
          </div>
        </div>

        {/* Savings Summary */}
        <div className={`p-4 rounded-lg border-2 ${
          totalSavings > 0 
            ? 'bg-green-50 border-green-200' 
            : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <h4 className={`font-semibold ${
                totalSavings > 0 ? 'text-green-700' : 'text-red-700'
              }`}>
                {totalSavings > 0 ? '💰 Total Savings' : '⚠️ Additional Cost'}
              </h4>
              <p className={`text-sm ${
                totalSavings > 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {totalSavings > 0 
                  ? 'You save money with the dynamic system!' 
                  : 'The static system would be cheaper in this case.'
                }
              </p>
            </div>
            <div className={`text-2xl font-bold ${
              totalSavings > 0 ? 'text-green-700' : 'text-red-700'
            }`}>
              {totalSavings > 0 ? '-' : '+'}{Math.abs(totalSavings).toFixed(4)} ETH
            </div>
          </div>
        </div>

        {/* Benefits Breakdown */}
        <div className="bg-indigo-50 p-4 rounded-lg">
          <h4 className="font-semibold text-indigo-700 mb-3">🌟 Dynamic System Benefits</h4>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <ul className="space-y-1 text-indigo-600">
              <li>✅ Personalized risk assessment</li>
              <li>✅ ML-driven chronotype optimization</li>
              <li>✅ Behavioral consistency rewards</li>
              <li>✅ Real-time risk adjustment</li>
            </ul>
            <ul className="space-y-1 text-indigo-600">
              <li>✅ Lower collateral for good users</li>
              <li>✅ Better interest rates</li>
              <li>✅ Encourages healthy borrowing patterns</li>
              <li>✅ Continuous learning and improvement</li>
            </ul>
          </div>
        </div>

        {/* Rate Comparison Details */}
        {rateComparison && (
          <div className="bg-purple-50 p-4 rounded-lg">
            <h4 className="font-semibold text-purple-700 mb-3">📊 Interest Rate Analysis</h4>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <div className="text-purple-600">Traditional Rate</div>
                <div className="font-bold text-purple-800">
                  {(parseFloat(rateComparison.traditional_rate) * 100).toFixed(3)}%
                </div>
              </div>
              <div className="text-center">
                <div className="text-purple-600">ML-Enhanced Rate</div>
                <div className="font-bold text-purple-800">
                  {(parseFloat(rateComparison.ml_enhanced_rate) * 100).toFixed(3)}%
                </div>
              </div>
              <div className="text-center">
                <div className="text-purple-600">Rate Improvement</div>
                <div className={`font-bold ${
                  rateComparison.ml_beneficial ? 'text-green-600' : 'text-red-600'
                }`}>
                  {rateComparison.ml_beneficial ? '↓' : '↑'}
                  {(parseFloat(rateComparison.savings) * 100).toFixed(3)}%
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ==================== MAIN CALCULATOR COMPONENT ====================

const DynamicCollateralCalculator: React.FC = () => {
  const [state, setState] = useState<CalculatorState>({
    isLoading: false,
    tokens: [],
    selectedToken: 0,
    borrowAmount: '0.1',
    userAddress: null,
    calculation: null,
    borrowingTerms: null,
    rateComparison: null,
    userInsights: null,
    mlPrediction: null,
    error: null,
    lastUpdate: 0
  });

  // Initialize component
  useEffect(() => {
    const initialize = async () => {
      try {
        // Initialize contract service if needed
        if (!contractService.isInitialized) {
          await contractService.init();
        }

        // Get tokens
        const tokens = await contractService.getTokenDetails();
        
        // Get user address if wallet is connected
        let userAddress: string | null = null;
        try {
          if (contractService.signer) {
            userAddress = await contractService.signer.getAddress();
          }
        } catch (error) {
          console.warn('Could not get user address:', error);
        }

        setState(prev => ({
          ...prev,
          tokens,
          userAddress
        }));

        // Initial calculation
        if (tokens.length > 0) {
          await performCalculation(tokens, 0, '0.1', userAddress);
        }
      } catch (error) {
        console.error('Failed to initialize calculator:', error);
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Initialization failed'
        }));
      }
    };

    initialize();
  }, []);

  // Perform comprehensive calculation
  const performCalculation = useCallback(async (
    tokens: TokenInfo[],
    tokenType: number,
    amount: string,
    userAddress: string | null
  ) => {
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const selectedToken = tokens.find(t => t.type === tokenType);
      if (!selectedToken) {
        throw new Error('Selected token not found');
      }

      // Calculate borrow value
      const tokenAmount = parseFloat(amount);
      const tokenValue = parseFloat(selectedToken.value);
      const borrowValue = tokenAmount * tokenValue;

      // Get borrowing terms preview
      const borrowingTerms = userAddress 
        ? await contractService.previewBorrowingTerms(userAddress, tokenType, amount)
        : {
            required_collateral: (borrowValue * 1.5).toString(),
            interest_rate: (selectedToken.rate / 100).toString(),
            risk_score: 500
          };

      // Calculate static collateral (150%)
      const staticCollateral = borrowValue * 1.5;
      const dynamicCollateral = parseFloat(borrowingTerms.required_collateral);

      // Get user insights if available
      let userInsights: UserMLInsights | null = null;
      let rateComparison: RateComparison | null = null;
      
      if (userAddress) {
        try {
          [userInsights, rateComparison] = await Promise.all([
            contractService.getUserMLCircadianInsights(userAddress),
            contractService.compareRateCalculations(userAddress, tokenType, amount)
          ]);
        } catch (error) {
          console.warn('Could not get user insights:', error);
        }
      }

      // Try to get ML prediction for current user activity
      let mlPrediction: ChronotypePrediction | null = null;
      try {
        // Generate sample pattern for demonstration
        const samplePattern = mlService.generateSampleActivityPattern('intermediate');
        mlPrediction = await mlService.predictChronotype(samplePattern.values, false);
      } catch (error) {
        console.warn('Could not get ML prediction:', error);
      }

      // Calculate risk multipliers (estimated based on contract logic)
      const tokenMultipliers = [9500, 10000, 11000, 12000]; // SLT, STD, PLT, MLT
      const tokenMultiplier = tokenMultipliers[tokenType] || 10000;
      
      const chronotypeMultiplier = mlPrediction?.chronotype === 0 ? 9500 : 
                                  mlPrediction?.chronotype === 2 ? 11000 : 10000;
      
      const riskScoreMultiplier = userInsights 
        ? (userInsights.risk_score < 300 ? 9500 : userInsights.risk_score > 700 ? 11500 : 10000)
        : 10000;

      const totalMultiplier = (tokenMultiplier * chronotypeMultiplier * riskScoreMultiplier) / (10000 * 10000);

      // Build calculation result
      const calculation: CollateralCalculation = {
        baseCollateral: borrowValue * 1.5,
        dynamicCollateral,
        staticCollateral,
        collateralSavings: staticCollateral - dynamicCollateral,
        riskMultipliers: {
          tokenMultiplier,
          chronotypeMultiplier,
          riskScoreMultiplier,
          totalMultiplier
        },
        recommendation: dynamicCollateral < staticCollateral * 0.9 ? 'excellent' :
                       dynamicCollateral < staticCollateral ? 'good' :
                       dynamicCollateral < staticCollateral * 1.1 ? 'fair' : 'poor'
      };

      setState(prev => ({
        ...prev,
        isLoading: false,
        calculation,
        borrowingTerms,
        rateComparison,
        userInsights,
        mlPrediction,
        lastUpdate: Date.now()
      }));

    } catch (error) {
      console.error('Calculation failed:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Calculation failed'
      }));
    }
  }, []);

  // Handle token change
  const handleTokenChange = useCallback((tokenType: number) => {
    setState(prev => ({ ...prev, selectedToken: tokenType }));
    performCalculation(state.tokens, tokenType, state.borrowAmount, state.userAddress);
  }, [state.tokens, state.borrowAmount, state.userAddress, performCalculation]);

  // Handle amount change
  const handleAmountChange = useCallback((amount: string) => {
    setState(prev => ({ ...prev, borrowAmount: amount }));
    
    // Debounce calculation
    const timeoutId = setTimeout(() => {
      performCalculation(state.tokens, state.selectedToken, amount, state.userAddress);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [state.tokens, state.selectedToken, state.userAddress, performCalculation]);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            🎯 Dynamic Collateral Calculator
          </h1>
          <p className="text-lg text-gray-600">
            Calculate personalized collateral requirements with ML-enhanced risk assessment
          </p>
          {state.userAddress && (
            <p className="text-sm text-blue-600 mt-2">
              Connected: {state.userAddress.slice(0, 6)}...{state.userAddress.slice(-4)}
            </p>
          )}
        </div>

        {/* Error Display */}
        {state.error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <span className="text-red-500 text-xl mr-2">⚠️</span>
              <div>
                <h3 className="text-lg font-semibold text-red-800">Calculation Error</h3>
                <p className="text-red-700">{state.error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Token Selector */}
        {state.tokens.length > 0 && (
          <TokenSelector
            tokens={state.tokens}
            selectedToken={state.selectedToken}
            onTokenChange={handleTokenChange}
          />
        )}

        {/* Amount Input */}
        {state.tokens.length > 0 && (
          <AmountInput
            amount={state.borrowAmount}
            onAmountChange={handleAmountChange}
            selectedToken={state.selectedToken}
            tokens={state.tokens}
          />
        )}

        {/* Loading State */}
        {state.isLoading && (
          <div className="bg-white rounded-lg shadow-lg p-8 mb-6 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold text-gray-800">
              Calculating Collateral Requirements...
            </h3>
            <p className="text-gray-600">
              Analyzing risk factors and ML insights
            </p>
          </div>
        )}

        {/* Results */}
        {!state.isLoading && state.calculation && state.borrowingTerms && (
          <>
            {/* Collateral Breakdown */}
            <CollateralBreakdown
              calculation={state.calculation}
              borrowingTerms={state.borrowingTerms}
              selectedToken={state.selectedToken}
              tokens={state.tokens}
            />

            {/* Risk Factors */}
            <RiskFactors
              calculation={state.calculation}
              userInsights={state.userInsights}
              mlPrediction={state.mlPrediction}
            />

            {/* Comparison View */}
            <ComparisonView
              calculation={state.calculation}
              rateComparison={state.rateComparison}
              borrowAmount={state.borrowAmount}
            />
          </>
        )}

        {/* Getting Started */}
        {!state.calculation && !state.isLoading && state.tokens.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="text-6xl mb-4">🧮</div>
            <h3 className="text-2xl font-semibold text-gray-800 mb-4">
              Dynamic Collateral Calculator
            </h3>
            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Enter your borrowing amount above to see how our ML-enhanced dynamic 
              collateral system can optimize your lending terms based on your risk profile.
            </p>
            <div className="grid md:grid-cols-3 gap-4 max-w-4xl mx-auto">
              <div className="p-4">
                <div className="text-3xl mb-2">🎯</div>
                <h4 className="font-semibold mb-2">Personalized Assessment</h4>
                <p className="text-sm text-gray-600">
                  Risk calculation based on your unique borrowing history
                </p>
              </div>
              <div className="p-4">
                <div className="text-3xl mb-2">🧬</div>
                <h4 className="font-semibold mb-2">ML-Enhanced</h4>
                <p className="text-sm text-gray-600">
                  Chronotype detection for optimal timing benefits
                </p>
              </div>
              <div className="p-4">
                <div className="text-3xl mb-2">💰</div>
                <h4 className="font-semibold mb-2">Cost Savings</h4>
                <p className="text-sm text-gray-600">
                  Lower collateral requirements for responsible borrowers
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Last Update */}
        {state.lastUpdate > 0 && (
          <div className="text-center text-sm text-gray-500 mt-6">
            Last calculation: {new Date(state.lastUpdate).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
};

export default DynamicCollateralCalculator;
