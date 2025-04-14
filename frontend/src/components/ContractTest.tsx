import { useState, useEffect } from 'react';
import contractService from '../services/ContractService';
import { TokenInfo } from '../services/ContractService';

const ContractTest = () => {
  const [tokenCount, setTokenCount] = useState<number | null>(null);
  const [tokenDetails, setTokenDetails] = useState<TokenInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeContracts = async () => {
      try {
        setLoading(true);
        await contractService.init();
        
        // Get token count
        const count = await contractService.getSupportedTokenCount();
        setTokenCount(count);
        
        // Get token details
        const details = await contractService.getTokenDetails();
        setTokenDetails(details);
        
        setLoading(false);
      } catch (err) {
        console.error('Contract connection error:', err);
        setError(`Failed to connect: ${err instanceof Error ? err.message : String(err)}`);
        setLoading(false);
      }
    };

    initializeContracts();
  }, []);

  return (
    <div className="contract-test">
      <h2>Blockchain Connection Test</h2>
      {loading ? (
        <p>Connecting to blockchain...</p>
      ) : error ? (
        <div className="error-container">
          <p className="error-message">{error}</p>
          <p>Make sure your Hardhat node is running with:</p>
          <pre>cd .. && npm run start</pre>
        </div>
      ) : (
        <div className="success-container">
          <p className="success-message">✅ Successfully connected to LendingBank contract!</p>
          <p>Number of supported tokens: {tokenCount}</p>
          <h3>Available Tokens:</h3>
          <div className="token-list">
            {tokenDetails.map((token, index) => (
              <div key={index} className="token-card">
                <h4>{token.name}</h4>
                <p><strong>Value:</strong> {token.value} ETH</p>
                <p><strong>Interest Rate:</strong> {token.rate}%</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ContractTest;
