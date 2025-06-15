import { useState } from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import WalletConnect from './components/WalletConnect'
import TokenSelector from './components/TokenSelector'
import BorrowForm from './components/BorrowForm'
import UserLoans from './components/UserLoans'
import TokenBalances from './components/TokenBalances'
import TokenStatistics from './components/TokenStatistics'
import TransactionHistory from './components/TransactionHistory'
import CollateralStatistics from './components/CollateralStatistics'
import CircadianMLDashboard from './components/CircadianMLDashboard'
import DynamicCollateralCalculator from './components/DynamicCollateralCalculator'
import ChronotypeAnalytics from './components/ChronotypeAnalytics'

// Borrowing View Component
const BorrowView = () => {
  const [selectedTokenType, setSelectedTokenType] = useState<number | null>(null)

  const handleTokenSelect = (tokenType: number) => {
    setSelectedTokenType(tokenType)
    console.log(`Selected token type: ${tokenType}`)
  }

  return (
    <>
      <h2>Borrow Tokens</h2>
      
      {/* Token Selector component */}
      <TokenSelector onSelectToken={handleTokenSelect} />
      
      {selectedTokenType !== null && (
        <BorrowForm selectedTokenType={selectedTokenType} />
      )}
      
      {/* Show selected token information */}
      {selectedTokenType !== null && (
        <div className="selection-info">
          <p>You selected token type: {selectedTokenType + 1}</p>
        </div>
      )}
    </>
  )
}

// Loans View Component
const LoansView = () => {
  return (
    <>
      <h2>Manage Your Loans</h2>
      <UserLoans />
    </>
  )
}

// Dashboard View Component
const DashboardView = () => {
  return (
    <>
      <h2>Dashboard</h2>
      
      {/* Show total collateral locked in protocol */}
      <CollateralStatistics />

      {/* Token balances show what tokens the borrower has received */}
      <TokenBalances />
      
      {/* Protocol statistics show overall token information */}
      <TokenStatistics />
      
      {/* Transaction history shows all past activities */}
      <TransactionHistory />
    </>
  )
}

// Navigation Tabs Component
const NavTabs = () => {
  const location = useLocation();
  
  return (
    <div className="nav-tabs">
      <Link 
        to="/" 
        className={`tab ${location.pathname === '/' ? 'active' : ''}`}
      >
        Borrow
      </Link>
      <Link 
        to="/loans" 
        className={`tab ${location.pathname === '/loans' ? 'active' : ''}`}
      >
        My Loans
      </Link>
      <Link 
        to="/dashboard" 
        className={`tab ${location.pathname === '/dashboard' ? 'active' : ''}`}
      >
        Dashboard
      </Link>
      <Link 
        to="/circadian-dashboard" 
        className={`tab ${location.pathname === '/circadian-dashboard' ? 'active' : ''}`}
      >
        🧬 ML Dashboard
      </Link>
      <Link 
        to="/collateral-calculator" 
        className={`tab ${location.pathname === '/collateral-calculator' ? 'active' : ''}`}
      >
        🎯 Calculator
      </Link>
      <Link 
        to="/chronotype-analytics" 
        className={`tab ${location.pathname === '/chronotype-analytics' ? 'active' : ''}`}
      >
        📊 Analytics
      </Link>
    </div>
  );
}

function App() {
  const [count, setCount] = useState(0)

  return (
    <BrowserRouter>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      
      <h1>DeFi Lending Platform</h1>
      
      {/* Wallet connect component */}
      <WalletConnect />
      
      {/* Navigation Tabs */}
      <NavTabs />
      
      {/* Routes for different views */}
      <div className="view-container">
        <Routes>
          <Route path="/" element={<BorrowView />} />
          <Route path="/loans" element={<LoansView />} />
          <Route path="/dashboard" element={<DashboardView />} />
          <Route path="/circadian-dashboard" element={<CircadianMLDashboard />} />
          <Route path="/collateral-calculator" element={<DynamicCollateralCalculator />} />
          <Route path="/chronotype-analytics" element={<ChronotypeAnalytics />} />
        </Routes>
      </div>
      
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </BrowserRouter>
  )
}

export default App
