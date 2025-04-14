import { useState } from 'react';
import { Link } from 'react-router-dom';
import WalletConnect from '../components/WalletConnect';
import TokenSelector from '../components/TokenSelector';
import BorrowForm from '../components/BorrowForm';
import './HomePage.css';

const HomePage = () => {
  const [selectedTokenType, setSelectedTokenType] = useState<number | null>(null);

  const handleTokenSelect = (tokenType: number) => {
    setSelectedTokenType(tokenType);
  };

  return (
    <div className="home-page">
      <div className="page-header">
        <h1>DeFi Lending Platform</h1>
        <div className="header-actions">
          <WalletConnect />
          <Link to="/loans" className="nav-button">
            View My Loans
          </Link>
        </div>
      </div>
      
      <div className="page-content">
        <h2>Borrow Tokens</h2>
        <p className="intro-text">
          Select a token below to borrow against ETH collateral. All loans require 
          150% collateralization and accrue interest over time.
        </p>
        
        <TokenSelector onSelectToken={handleTokenSelect} />
        
        {selectedTokenType !== null && (
          <BorrowForm selectedTokenType={selectedTokenType} />
        )}
      </div>
    </div>
  );
};

export default HomePage;
