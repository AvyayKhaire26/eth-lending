// src/components/TokenSelector.tsx
import { useEffect, useState } from 'react';
import contractService from '../services/ContractService';
import { TokenInfo } from '../services/ContractService';
import './TokenSelector.css';

interface TokenSelectorProps {
  onSelectToken: (tokenType: number) => void;
}

const TokenSelector = ({ onSelectToken }: TokenSelectorProps) => {
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedToken, setSelectedToken] = useState<number | null>(null);

  useEffect(() => {
    const loadTokens = async () => {
      try {
        setLoading(true);
        const tokenDetails = await contractService.getTokenDetails();
        setTokens(tokenDetails);
        setLoading(false);
      } catch (err) {
        console.error('Failed to load tokens:', err);
        setError(`Failed to load tokens: ${err instanceof Error ? err.message : String(err)}`);
        setLoading(false);
      }
    };

    loadTokens();
  }, []);

  const handleTokenSelect = (tokenType: number) => {
    setSelectedToken(tokenType);
    onSelectToken(tokenType);
  };

  if (loading) {
    return <div className="loading">Loading available tokens...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <div className="token-selector">
      <h2>Select a token to borrow</h2>
      <div className="token-grid">
        {tokens.map((token) => (
          <div 
            key={token.type}
            className={`token-card ${selectedToken === token.type ? 'selected' : ''}`}
            onClick={() => handleTokenSelect(token.type)}
          >
            <h3>{token.name}</h3>
            <div className="token-details">
              <p><strong>Value:</strong> {token.value} ETH</p>
              <p><strong>Interest Rate:</strong> {token.rate}%</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TokenSelector;
