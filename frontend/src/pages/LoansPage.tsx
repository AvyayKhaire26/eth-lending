import { Link } from 'react-router-dom';
import WalletConnect from '../components/WalletConnect';
import UserLoans from '../components/UserLoans';
import './LoansPage.css';

const LoansPage = () => {
  return (
    <div className="loans-page">
      <div className="page-header">
        <h1>DeFi Lending Platform</h1>
        <div className="header-actions">
          <WalletConnect />
          <Link to="/" className="nav-button">
            Back to Borrowing
          </Link>
        </div>
      </div>
      
      <div className="page-content">
        <h2>Manage Your Loans</h2>
        <p className="intro-text">
          View and manage your active loans. Repay loans to retrieve your collateral.
        </p>
        
        <UserLoans />
      </div>
    </div>
  );
};

export default LoansPage;
