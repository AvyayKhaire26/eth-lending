import { ethers } from 'ethers';
import LendingBankABI from '../contracts/abis/LendingBank.json';
import StableLoanTokenABI from '../contracts/abis/StableLoanToken.json';
import StandardLoanTokenABI from '../contracts/abis/StandardLoanToken.json';
import PremiumLoanTokenABI from '../contracts/abis/PremiumLoanToken.json';
import MegaLoanTokenABI from '../contracts/abis/MegaLoanToken.json';
import localDeployment from '../contracts/addresses/localhost-deployment.json';

// ==================== EXISTING INTERFACES ====================

// Define token information interface
export interface TokenInfo {
  name: string;
  type: number;
  value: string;
  rate: number;
  address: string;
}

// Define loan interface
export interface LoanInfo {
  id: number;
  borrower: string;
  collateralAmount: string;
  tokenType: number;
  tokenAmount: string;
  issuanceTimestamp: number;
  deadline: number;
  interestAccrued: string;
  active: boolean;
  issuanceDate: string;
  deadlineDate: string;
  timeRemaining: string;
  tokenName: string;
}

// Define transaction history interface
export interface TransactionHistory {
  id: string; // Unique ID for the transaction
  type: 'borrow' | 'repay';
  loanId: number;
  borrower: string;
  tokenType: number;
  tokenName: string;
  tokenAmount: string;
  collateralAmount: string;
  timestamp: number;
  date: string;
}

// Define token balance interface
export interface TokenBalance {
  tokenType: number;
  tokenName: string;
  balance: string;
  address: string;
}

// Define token statistics interface
export interface TokenStatistics {
  tokenType: number;
  tokenName: string;
  totalSupply: string;
  totalBorrowed: string;
  availableLiquidity: string;
  utilizationRate: number; // Percentage of tokens utilized
}

// ==================== NEW ML-RELATED INTERFACES ====================

// ML API Health Check interface
export interface MLAPIHealth {
  status: string;
  models_loaded: boolean;
  version: string;
}

// Chronotype prediction interface
export interface ChronotypePrediction {
  chronotype: number; // 0=Early, 1=Intermediate, 2=Late
  chronotype_name: string;
  confidence: number; // 0-1000
  success: boolean;
  error?: string;
}

// Circadian rate calculation interface
export interface CircadianRateResult {
  adjusted_rate: number;
  base_rate: number;
  chronotype: number;
  chronotype_name: string;
  confidence: number;
  hourly_multiplier: number;
  behavior_multiplier: number;
  current_hour: number;
}

// User ML insights interface
export interface UserMLInsights {
  consistency_score: number;
  total_sessions: number;
  preferred_hours: number[];
  current_rate_multiplier: number;
  ml_chronotype: number;
  ml_confidence: number;
  last_ml_update: number;
  risk_score: number;
  current_alignment: number;
}

// Rate comparison interface
export interface RateComparison {
  traditional_rate: string;
  ml_enhanced_rate: string;
  savings: string;
  ml_beneficial: boolean;
}

// Optimal borrowing times interface
export interface OptimalBorrowingTimes {
  optimal_hours: number[];
  rates: number[];
}

// Dynamic collateral preview interface
export interface BorrowingTerms {
  required_collateral: string;
  interest_rate: string;
  risk_score: number;
}

// User insights from ML API
export interface UserInsights {
  chronotype: number;
  chronotype_name: string;
  confidence: number;
  peak_activity_hour: number;
  optimal_borrowing_hours: number[];
  activity_summary: {
    morning_avg: number;
    afternoon_avg: number;
    evening_avg: number;
    night_avg: number;
  };
}

// ==================== NETWORK CONFIGURATION ====================

// Network configuration
interface NetworkConfig {
  name: string;
  url: string;
  chainId: number;
  deployment: any;
}

// Network configurations
const NETWORKS: Record<string, NetworkConfig> = {
  localhost: {
    name: 'Localhost',
    url: 'http://localhost:8545',
    chainId: 31337,
    deployment: localDeployment
  }
};

const DEFAULT_NETWORK = 'localhost';

// ==================== ENHANCED CONTRACT SERVICE ====================

class ContractService {
  provider: ethers.JsonRpcProvider | null = null;
  signer: ethers.Signer | null = null;
  lendingBank: ethers.Contract | null = null;
  tokens: Record<string, ethers.Contract> = {};
  network: string = DEFAULT_NETWORK;
  isInitialized: boolean = false;
  // Make ethers available to components
  ethers = ethers;
  
  // Store transaction history in memory (in a real app, this would be persistent)
  private transactionHistory: TransactionHistory[] = [];

  // ML API Configuration
  private mlApiUrl: string = 'http://localhost:5000';
  private mlApiTimeout: number = 10000; // 10 seconds timeout

  // Transaction configuration
  private readonly defaultGasLimit = 500000;
  private readonly gasLimitBuffer = 1.2; // 20% buffer
  private readonly maxRetries = 3;
  private readonly retryDelay = 2000; // 2 seconds

  // ==================== EXISTING INITIALIZATION METHODS ====================

  // Initialize provider with specified network
  async init(networkName = DEFAULT_NETWORK): Promise<ContractService> {
    try {
      this.network = networkName;
      const network = NETWORKS[networkName];
      
      if (!network) {
        throw new Error(`Network ${networkName} is not configured`);
      }
      
      if (!network.deployment) {
        throw new Error(`No deployment found for network ${networkName}`);
      }
      
      // Connect to provider
      this.provider = new ethers.JsonRpcProvider(network.url);
      
      // Test provider connection
      await this.provider.getNetwork();
      
      // Initialize LendingBank contract
      this.lendingBank = new ethers.Contract(
        network.deployment.lendingBank,
        LendingBankABI.abi,
        this.provider
      );
      
      // Initialize token contracts
      this.tokens = {
        stable: new ethers.Contract(
          network.deployment.stableLoanToken,
          StableLoanTokenABI.abi,
          this.provider
        ),
        standard: new ethers.Contract(
          network.deployment.standardLoanToken,
          StandardLoanTokenABI.abi,
          this.provider
        ),
        premium: new ethers.Contract(
          network.deployment.premiumLoanToken,
          PremiumLoanTokenABI.abi,
          this.provider
        ),
        mega: new ethers.Contract(
          network.deployment.megaLoanToken,
          MegaLoanTokenABI.abi,
          this.provider
        )
      };
      
      // Load transaction history from localStorage if available
      this.loadTransactionHistory();
      
      this.isInitialized = true;
      console.log('Contract service initialized successfully');
      return this;
    } catch (error) {
      console.error('Failed to initialize contract service:', error);
      throw error;
    }
  }
  
  // Connect to wallet (Metamask, etc.)
  async connectWallet(): Promise<ethers.Signer> {
    if (!this.isInitialized) {
      await this.init();
    }
    
    if (!window.ethereum) {
      throw new Error('MetaMask or compatible wallet not detected');
    }
    
    try {
      const ethersProvider = new ethers.BrowserProvider(window.ethereum);
      await ethersProvider.send('eth_requestAccounts', []);
      this.signer = await ethersProvider.getSigner();
      
      // Re-initialize contracts with signer
      if (this.lendingBank && this.provider) {
        this.lendingBank = new ethers.Contract(
          await this.lendingBank.getAddress(),
          LendingBankABI.abi,
          this.signer
        );
      }
      
      // Connect tokens to signer
      for (const [key, contract] of Object.entries(this.tokens)) {
        const address = await contract.getAddress();
        let abi;
        
        // Get the right ABI based on token type
        switch (key) {
          case 'stable':
            abi = StableLoanTokenABI.abi;
            break;
          case 'standard':
            abi = StandardLoanTokenABI.abi;
            break;
          case 'premium':
            abi = PremiumLoanTokenABI.abi;
            break;
          case 'mega':
            abi = MegaLoanTokenABI.abi;
            break;
          default:
            throw new Error(`Unknown token type: ${key}`);
        }
        
        this.tokens[key] = new ethers.Contract(address, abi, this.signer);
      }
      
      return this.signer;
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
    }
  }

  // ==================== ENHANCED TRANSACTION HELPERS ====================

  // Estimate gas with buffer
  private async estimateGasWithBuffer(contractCall: any): Promise<bigint> {
    try {
      const estimatedGas = await contractCall.estimateGas();
      return BigInt(Math.floor(Number(estimatedGas) * this.gasLimitBuffer));
    } catch (error) {
      console.warn('Gas estimation failed, using default:', error);
      return BigInt(this.defaultGasLimit);
    }
  }

  // Execute transaction with retry logic
  private async executeTransaction(
    contractCall: any,
    description: string,
    retryCount = 0
  ): Promise<any> {
    try {
      console.log(`Executing ${description} (attempt ${retryCount + 1})`);
      
      // Estimate gas
      const gasLimit = await this.estimateGasWithBuffer(contractCall);
      
      // Get current gas price
      let gasPrice;
      try {
        const feeData = await this.provider!.getFeeData();
        gasPrice = feeData.gasPrice || ethers.parseUnits('20', 'gwei');
      } catch {
        gasPrice = ethers.parseUnits('20', 'gwei'); // Fallback gas price
      }

      // Execute transaction
      const tx = await contractCall({
        gasLimit,
        gasPrice,
        timeout: 60000 // 60 second timeout
      });
      
      console.log(`${description} transaction sent:`, tx.hash);
      
      // Wait for confirmation
      const receipt = await tx.wait(1);
      
      if (!receipt || receipt.status !== 1) {
        throw new Error(`${description} transaction failed`);
      }
      
      console.log(`${description} transaction confirmed:`, receipt.hash);
      return receipt;
      
    } catch (error: any) {
      console.error(`${description} failed (attempt ${retryCount + 1}):`, error);
      
      // Handle specific errors
      if (error.code === 'TIMEOUT') {
        if (retryCount < this.maxRetries - 1) {
          console.log(`Retrying ${description} due to timeout...`);
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
          return this.executeTransaction(contractCall, description, retryCount + 1);
        }
        throw new Error(`${description} timed out after ${this.maxRetries} attempts`);
      }
      
      if (error.code === 'UNPREDICTABLE_GAS_LIMIT' || error.code === -32603) {
        throw new Error(`${description} failed: Transaction would revert. Please check your balance and try again.`);
      }
      
      if (error.code === 'INSUFFICIENT_FUNDS') {
        throw new Error(`${description} failed: Insufficient funds for gas and transaction value.`);
      }
      
      if (error.message?.includes('user rejected')) {
        throw new Error(`${description} cancelled by user.`);
      }
      
      // Retry on certain errors
      if (retryCount < this.maxRetries - 1 && 
          (error.code === 'NETWORK_ERROR' || error.code === 'SERVER_ERROR')) {
        console.log(`Retrying ${description} due to network error...`);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.executeTransaction(contractCall, description, retryCount + 1);
      }
      
      throw error;
    }
  }

  // ==================== NEW ML API INTEGRATION METHODS ====================

  // Check ML API health
  async checkMLAPIHealth(): Promise<MLAPIHealth> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.mlApiTimeout);

      const response = await fetch(`${this.mlApiUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`ML API health check failed: ${response.status}`);
      }

      const health = await response.json();
      return health;
    } catch (error) {
      console.error('ML API health check failed:', error);
      return {
        status: 'unhealthy',
        models_loaded: false,
        version: 'unknown'
      };
    }
  }

  // Predict chronotype from activity pattern
  async predictChronotype(activityPattern: number[]): Promise<ChronotypePrediction> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.mlApiTimeout);

      const response = await fetch(`${this.mlApiUrl}/predict_chronotype`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          activity_pattern: activityPattern
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Chronotype prediction failed: ${response.status}`);
      }

      const prediction = await response.json();
      return {
        ...prediction,
        success: true
      };
    } catch (error) {
      console.error('Chronotype prediction failed:', error);
      return {
        chronotype: 1,
        chronotype_name: 'Intermediate',
        confidence: 500,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Calculate circadian-adjusted rate
  async calculateCircadianRate(
    baseRate: number,
    currentHour: number,
    userActivity: number[]
  ): Promise<CircadianRateResult> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.mlApiTimeout);

      const response = await fetch(`${this.mlApiUrl}/calculate_circadian_rate`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          base_rate: baseRate,
          current_hour: currentHour,
          user_activity: userActivity
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Circadian rate calculation failed: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Circadian rate calculation failed:', error);
      throw error;
    }
  }

  // Get user insights from ML API
  async getUserInsights(activityPattern: number[]): Promise<UserInsights> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.mlApiTimeout);

      const response = await fetch(`${this.mlApiUrl}/user_insights`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          activity_pattern: activityPattern
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`User insights failed: ${response.status}`);
      }

      const insights = await response.json();
      return insights;
    } catch (error) {
      console.error('User insights failed:', error);
      throw error;
    }
  }

  // ==================== NEW ENHANCED CONTRACT METHODS ====================

  // Get dynamic collateral requirement
  async calculateDynamicCollateral(
    userAddress: string,
    tokenType: number,
    borrowValue: string
  ): Promise<string> {
    if (!this.lendingBank) {
      throw new Error('LendingBank contract not initialized');
    }

    try {
      const borrowValueWei = ethers.parseEther(borrowValue);
      const collateralRequired = await this.lendingBank.calculateDynamicCollateral(
        userAddress,
        tokenType,
        borrowValueWei
      );
      
      return ethers.formatEther(collateralRequired);
    } catch (error) {
      console.error('Failed to calculate dynamic collateral:', error);
      throw error;
    }
  }

  // Preview borrowing terms
  async previewBorrowingTerms(
    userAddress: string,
    tokenType: number,
    tokenAmount: string
  ): Promise<BorrowingTerms> {
    if (!this.lendingBank) {
      throw new Error('LendingBank contract not initialized');
    }

    try {
      const tokenAmountWei = ethers.parseEther(tokenAmount);
      const [requiredCollateral, interestRate, riskScore] = await this.lendingBank.previewBorrowingTerms(
        userAddress,
        tokenType,
        tokenAmountWei
      );
      
      return {
        required_collateral: ethers.formatEther(requiredCollateral),
        interest_rate: ethers.formatEther(interestRate),
        risk_score: Number(riskScore)
      };
    } catch (error) {
      console.error('Failed to preview borrowing terms:', error);
      throw error;
    }
  }

  // Get user ML circadian insights from contract
  async getUserMLCircadianInsights(userAddress: string): Promise<UserMLInsights> {
    if (!this.lendingBank) {
      throw new Error('LendingBank contract not initialized');
    }

    try {
      const insights = await this.lendingBank.getUserMLCircadianInsights(userAddress);
      
      return {
        consistency_score: Number(insights[0]),
        total_sessions: Number(insights[1]),
        preferred_hours: insights[2].map((h: bigint) => Number(h)),
        current_rate_multiplier: Number(insights[3]),
        ml_chronotype: Number(insights[4]),
        ml_confidence: Number(insights[5]),
        last_ml_update: Number(insights[6]),
        risk_score: Number(insights[7]),
        current_alignment: Number(insights[8])
      };
    } catch (error) {
      console.error('Failed to get user ML insights:', error);
      throw error;
    }
  }

  // Compare traditional vs ML-enhanced rates
  async compareRateCalculations(
    userAddress: string,
    tokenType: number,
    amount: string
  ): Promise<RateComparison> {
    if (!this.lendingBank) {
      throw new Error('LendingBank contract not initialized');
    }

    try {
      const amountWei = ethers.parseEther(amount);
      const [traditionalRate, mlEnhancedRate, savings, mlBeneficial] = 
        await this.lendingBank.compareRateCalculations(userAddress, tokenType, amountWei);
      
      return {
        traditional_rate: ethers.formatEther(traditionalRate),
        ml_enhanced_rate: ethers.formatEther(mlEnhancedRate),
        savings: ethers.formatEther(savings),
        ml_beneficial: mlBeneficial
      };
    } catch (error) {
      console.error('Failed to compare rate calculations:', error);
      throw error;
    }
  }

  // Get optimal borrowing times for user
  async getOptimalBorrowingTimes(userAddress: string): Promise<OptimalBorrowingTimes> {
    if (!this.lendingBank) {
      throw new Error('LendingBank contract not initialized');
    }

    try {
      const [optimalHours, rates] = await this.lendingBank.getOptimalBorrowingTimes(userAddress);
      
      return {
        optimal_hours: optimalHours.map((h: bigint) => Number(h)),
        rates: rates.map((r: bigint) => Number(ethers.formatEther(r)))
      };
    } catch (error) {
      console.error('Failed to get optimal borrowing times:', error);
      throw error;
    }
  }

  // ==================== ENHANCED BORROWING METHODS ====================

  // Enhanced borrow with ML prediction option
  async borrowTokensWithML(
    tokenType: number,
    tokenAmount: string,
    collateralAmount: string,
    activityPattern?: number[]
  ): Promise<any> {
    if (!this.lendingBank || !this.signer) {
      throw new Error('Contract not initialized or wallet not connected');
    }

    try {
      const tokenAmountWei = ethers.parseEther(tokenAmount);
      const collateralAmountWei = ethers.parseEther(collateralAmount);

      let contractCall;

      if (activityPattern && activityPattern.length >= 24) {
        // Use ML prediction enhanced borrowing
        console.log('Using ML prediction enhanced borrowing');
        
        contractCall = () => this.lendingBank!.borrowWithMLPrediction(
          tokenType,
          tokenAmountWei,
          activityPattern,
          { value: collateralAmountWei }
        );
      } else {
        // Use standard borrowing
        console.log('Using standard borrowing');
        
        contractCall = () => this.lendingBank!.depositAndBorrow(
          tokenType,
          tokenAmountWei,
          { value: collateralAmountWei }
        );
      }

      const receipt = await this.executeTransaction(
        contractCall,
        'ML Enhanced Borrowing'
      );

      // Add to transaction history
      const borrowerAddress = await this.signer.getAddress();
      
      this.addToTransactionHistory({
        id: `ml-borrow-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        type: 'borrow',
        loanId: this.transactionHistory.length + 1,
        borrower: borrowerAddress,
        tokenType: tokenType,
        tokenName: this.getTokenNameByType(tokenType),
        tokenAmount: tokenAmount,
        collateralAmount: collateralAmount,
        timestamp: Math.floor(Date.now() / 1000),
        date: new Date().toLocaleString()
      });

      return receipt;
    } catch (error: any) {
      console.error('Enhanced borrow transaction error:', error);
      throw error;
    }
  }

  // Original borrow tokens method with enhanced error handling
  async borrowTokens(
    tokenType: number, 
    tokenAmount: string, 
    collateralAmount: string
  ): Promise<any> {
    if (!this.lendingBank || !this.signer) {
      throw new Error('Contract not initialized or wallet not connected');
    }
    
    try {
      const tokenAmountWei = ethers.parseEther(tokenAmount);
      const collateralAmountWei = ethers.parseEther(collateralAmount);
      
      const contractCall = () => this.lendingBank!.depositAndBorrow(
        tokenType,
        tokenAmountWei,
        { value: collateralAmountWei }
      );

      const receipt = await this.executeTransaction(contractCall, 'Standard Borrowing');
      
      const borrowerAddress = await this.signer.getAddress();
      
      this.addToTransactionHistory({
        id: `borrow-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        type: 'borrow',
        loanId: this.transactionHistory.length + 1,
        borrower: borrowerAddress,
        tokenType: tokenType,
        tokenName: this.getTokenNameByType(tokenType),
        tokenAmount: tokenAmount,
        collateralAmount: collateralAmount,
        timestamp: Math.floor(Date.now() / 1000),
        date: new Date().toLocaleString()
      });
      
      return receipt;
    } catch (error: any) {
      console.error('Transaction error details:', error);
      throw error;
    }
  }

  // ==================== EXISTING METHODS (Enhanced with better error handling) ====================

  // Get supported token count
  async getSupportedTokenCount(): Promise<number> {
    if (!this.lendingBank) {
      throw new Error('LendingBank contract not initialized');
    }
    
    try {
      const count = await this.lendingBank.getSupportedTokenCount();
      return Number(count);
    } catch (error) {
      console.error('Failed to get supported token count:', error);
      throw error;
    }
  }
  
  // Get token details
  async getTokenDetails(): Promise<TokenInfo[]> {
    if (!this.isInitialized) {
      await this.init();
    }
    
    try {
      const tokenPromises = Object.entries(this.tokens).map(async ([key, contract], index) => {
        const value = await contract.tokenValue();
        const rate = await contract.interestRate();
        
        return {
          name: this.getTokenName(key),
          type: index,
          value: ethers.formatEther(value),
          rate: Number(rate) / 100,
          address: await contract.getAddress()
        };
      });
      
      return await Promise.all(tokenPromises);
    } catch (error) {
      console.error('Failed to get token details:', error);
      throw error;
    }
  }
  
  // Get user token balances
  async getUserTokenBalances(userAddress?: string): Promise<TokenBalance[]> {
    if (!this.isInitialized) {
      await this.init();
    }
    
    try {
      const address = userAddress || (this.signer ? await this.signer.getAddress() : null);
      
      if (!address) {
        throw new Error('No user address provided and no wallet connected');
      }
      
      const balancePromises = Object.entries(this.tokens).map(async ([key, contract], index) => {
        const balance = await contract.balanceOf(address);
        
        return {
          tokenType: index,
          tokenName: this.getTokenName(key),
          balance: ethers.formatEther(balance),
          address: await contract.getAddress()
        };
      });
      
      return await Promise.all(balancePromises);
    } catch (error) {
      console.error('Failed to get token balances:', error);
      throw error;
    }
  }
  
  // Get token statistics
  async getTokenStatistics(): Promise<TokenStatistics[]> {
    if (!this.lendingBank) {
      throw new Error('LendingBank contract not initialized');
    }
    
    try {
      const statsPromises = Object.entries(this.tokens).map(async ([key, contract], index) => {
        const bankAddress = await this.lendingBank!.getAddress();
        const totalSupply = await contract.balanceOf(bankAddress);
        
        let totalBorrowed = ethers.parseEther("0");
        
        try {
          totalBorrowed = await this.lendingBank!.getTotalBorrowedForToken(index);
        } catch (err) {
          try {
            console.log('Using active loans to calculate borrowed amount');
            const activeLoans = await this.getAllActiveLoans();
            const tokenBorrowed = activeLoans
              .filter(loan => loan.tokenType === index)
              .reduce((sum, loan) => sum + parseFloat(loan.tokenAmount), 0);
            
            totalBorrowed = ethers.parseEther(tokenBorrowed.toString());
          } catch (innerErr) {
            console.log('Falling back to transaction history for borrowed calculation');
            let borrowedAmount = 0;
            
            this.transactionHistory
              .filter(tx => tx.tokenType === index)
              .forEach(tx => {
                if (tx.type === 'borrow') {
                  borrowedAmount += parseFloat(tx.tokenAmount);
                } else if (tx.type === 'repay') {
                  borrowedAmount -= parseFloat(tx.tokenAmount);
                }
              });
            
            borrowedAmount = Math.max(0, borrowedAmount);
            totalBorrowed = ethers.parseEther(borrowedAmount.toString());
          }
        }
        
        const totalSupplyETH = ethers.formatEther(totalSupply);
        const totalBorrowedETH = ethers.formatEther(totalBorrowed);
        const availableLiquidity = Math.max(0, parseFloat(totalSupplyETH) - parseFloat(totalBorrowedETH));
        
        const utilizationRate = parseFloat(totalSupplyETH) > 0 
          ? (parseFloat(totalBorrowedETH) / parseFloat(totalSupplyETH)) * 100 
          : 0;
        
        return {
          tokenType: index,
          tokenName: this.getTokenName(key),
          totalSupply: totalSupplyETH,
          totalBorrowed: totalBorrowedETH,
          availableLiquidity: availableLiquidity.toString(),
          utilizationRate: utilizationRate
        };
      });
      
      return await Promise.all(statsPromises);
    } catch (error) {
      console.error('Failed to get token statistics:', error);
      throw error;
    }
  }

  // Get user loans
  async getUserLoans(userAddress?: string): Promise<LoanInfo[]> {
    if (!this.lendingBank || !this.provider) {
      throw new Error('LendingBank contract not initialized');
    }
    
    try {
      const address = userAddress || (this.signer ? await this.signer.getAddress() : null);
      
      if (!address) {
        throw new Error('No user address provided and no wallet connected');
      }
      
      const loanIds = await this.lendingBank.getUserLoans(address);
      
      if (loanIds.length === 0) {
        return [];
      }
      
      const loanPromises = loanIds.map(async (id: bigint) => {
        const loan = await this.lendingBank?.getLoan(id);
        
        return {
          id: Number(id),
          borrower: loan.borrower,
          collateralAmount: ethers.formatEther(loan.collateralAmount),
          tokenType: Number(loan.tokenType),
          tokenAmount: ethers.formatEther(loan.tokenAmount),
          issuanceTimestamp: Number(loan.issuanceTimestamp),
          deadline: Number(loan.deadline),
          interestAccrued: ethers.formatEther(loan.interestAccrued),
          active: loan.active,
          tokenName: this.getTokenNameByType(Number(loan.tokenType)),
          issuanceDate: new Date(Number(loan.issuanceTimestamp) * 1000).toLocaleDateString(),
          deadlineDate: new Date(Number(loan.deadline) * 1000).toLocaleDateString(),
          timeRemaining: this.calculateTimeRemaining(Number(loan.deadline))
        };
      });
      
      const allLoans = await Promise.all(loanPromises);
      return allLoans.filter(loan => loan.active);
    } catch (error) {
      console.error('Failed to get user loans:', error);
      throw error;
    }
  }

  // Enhanced repay loan method with better error handling
  async repayLoan(loanId: number, _retryCount: number = 0): Promise<any> {
    if (!this.lendingBank || !this.signer) {
      throw new Error('Contract not initialized or wallet not connected');
    }
    
    try {
      const loan = await this.lendingBank.getLoan(loanId);
      
      if (!loan || !loan.active) {
        throw new Error('This loan is no longer active or could not be found');
      }
      
      const tokenType = Number(loan.tokenType);
      const tokenKeys = ['stable', 'standard', 'premium', 'mega'];
      const tokenKey = tokenKeys[tokenType];
      const tokenContract = this.tokens[tokenKey];
      
      if (!tokenContract) {
        throw new Error(`Token contract not found for type ${tokenType}`);
      }
      
      const userAddress = await this.signer.getAddress();
      let balance;
      try {
        balance = await tokenContract.balanceOf(userAddress);
      } catch (err) {
        throw new Error(`Failed to check token balance: ${err instanceof Error ? err.message : String(err)}`);
      }
      
      let totalDue;
      let interestAmount;
      try {
        interestAmount = await this.lendingBank.calculateInterest(loanId);
        totalDue = loan.tokenAmount + interestAmount;
      } catch (err) {
        throw new Error(`Failed to calculate total due amount: ${err instanceof Error ? err.message : String(err)}`);
      }
      
      if (balance < totalDue) {
        const formattedBalance = ethers.formatEther(balance);
        const formattedTotalDue = ethers.formatEther(totalDue);
        const formattedShortage = ethers.formatEther(totalDue - balance);
        
        throw {
          code: "INSUFFICIENT_FUNDS",
          message: `Insufficient token balance for repayment.`,
          details: {
            required: formattedTotalDue,
            available: formattedBalance,
            shortage: formattedShortage,
            tokenType: tokenType,
            tokenName: this.getTokenNameByType(tokenType)
          }
        };
      }
      
      console.log(`Approving ${ethers.formatEther(totalDue)} tokens for repayment`);
      
      // Approval with enhanced error handling
      const approvalCall = () => tokenContract.approve(
        this.lendingBank!.getAddress(),
        totalDue
      );
      
      const approvalReceipt = await this.executeTransaction(
        approvalCall,
        'Token Approval for Repayment'
      );
      
      console.log("Token approval confirmed:", approvalReceipt.hash);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Repayment with enhanced error handling
      const repaymentCall = () => this.lendingBank!.repay(loanId);
      
      const receipt = await this.executeTransaction(
        repaymentCall,
        'Loan Repayment'
      );
      
      console.log('Repayment successful:', receipt.hash);
      
      this.addToTransactionHistory({
        id: `repay-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        type: 'repay',
        loanId: loanId,
        borrower: userAddress,
        tokenType: tokenType,
        tokenName: this.getTokenNameByType(tokenType),
        tokenAmount: ethers.formatEther(loan.tokenAmount),
        collateralAmount: ethers.formatEther(loan.collateralAmount),
        timestamp: Math.floor(Date.now() / 1000),
        date: new Date().toLocaleString()
      });
      
      return receipt;
    } catch (error) {
      console.error('Failed to repay loan:', error);
      
      if (error && typeof error === 'object' && 'code' in error) {
        throw error;
      }
      
      let errorMessage = "An unknown error occurred during repayment";
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error === null) {
        errorMessage = "Null error received from blockchain";
      } else if (typeof error === 'object') {
        try {
          const cleanError: Record<string, any> = {};
          
          for (const [key, value] of Object.entries(error as Record<string, any>)) {
            cleanError[key] = value === null ? "null" : value;
          }
          errorMessage = JSON.stringify(cleanError);
        } catch (jsonErr) {
          errorMessage = String(error);
        }
      } else {
        errorMessage = String(error);
      }
      
      throw new Error(errorMessage);
    }
  }

  // Get total collateral
  async getTotalCollateral(): Promise<string> {
    if (!this.lendingBank) {
      throw new Error('LendingBank contract not initialized');
    }
    
    try {
      if (typeof this.lendingBank.getTotalCollateral === 'function') {
        const totalCollateral = await this.lendingBank.getTotalCollateral();
        return ethers.formatEther(totalCollateral);
      } else {
        const activeLoans = await this.getAllActiveLoans();
        const totalCollateral = activeLoans.reduce(
          (sum, loan) => sum + parseFloat(loan.collateralAmount), 
          0
        );
        return totalCollateral.toString();
      }
    } catch (error) {
      console.error('Failed to get total collateral:', error);
      throw error;
    }
  }

  // Get all active loans
  private async getAllActiveLoans(): Promise<LoanInfo[]> {
    if (!this.lendingBank || !this.provider) {
      throw new Error('LendingBank contract not initialized');
    }
    
    try {
      const activeLoans: LoanInfo[] = [];
      const processedBorrowers = new Set<string>();
      
      if (this.signer) {
        try {
          const address = await this.signer.getAddress();
          const userLoans = await this.getUserLoans(address);
          activeLoans.push(...userLoans);
          processedBorrowers.add(address.toLowerCase());
          console.log(`Found ${userLoans.length} loans for connected wallet`);
        } catch (error) {
          console.log('Failed to get loans for connected user:', error);
        }
      }
      
      for (const tx of this.transactionHistory) {
        if (!processedBorrowers.has(tx.borrower.toLowerCase())) {
          try {
            const borrowerLoans = await this.getUserLoans(tx.borrower);
            activeLoans.push(...borrowerLoans);
            processedBorrowers.add(tx.borrower.toLowerCase());
            console.log(`Found ${borrowerLoans.length} loans for ${tx.borrower} from history`);
          } catch (error) {
            console.log(`Failed to get loans for borrower ${tx.borrower}:`, error);
          }
        }
      }
      
      try {
        const currentBlock = await this.provider.getBlockNumber();
        const lookbackBlocks = 1000;
        const fromBlock = Math.max(0, currentBlock - lookbackBlocks);
        
        const eventsFilter = {
          address: await this.lendingBank.getAddress(),
          fromBlock: fromBlock,
          toBlock: 'latest'
        };
        
        const events = await this.provider.getLogs(eventsFilter);
        console.log(`Found ${events.length} contract events to check for borrowers`);
        
        for (const event of events) {
          const possibleAddresses = [];
          
          if (event.topics && event.topics.length > 1) {
            const topic1 = event.topics[1];
            if (topic1 && topic1.length >= 66) {
              const potentialAddress = '0x' + topic1.slice(26);
              if (ethers.isAddress(potentialAddress)) {
                possibleAddresses.push(potentialAddress);
              }
            }
          }
          
          if (event.topics && event.topics.length > 2) {
            const topic2 = event.topics[2];
            if (topic2 && topic2.length >= 66) {
              const potentialAddress = '0x' + topic2.slice(26);
              if (ethers.isAddress(potentialAddress)) {
                possibleAddresses.push(potentialAddress);
              }
            }
          }
          
          for (const address of possibleAddresses) {
            if (!processedBorrowers.has(address.toLowerCase())) {
              try {
                const borrowerLoans = await this.getUserLoans(address);
                if (borrowerLoans.length > 0) {
                  activeLoans.push(...borrowerLoans);
                  processedBorrowers.add(address.toLowerCase());
                  console.log(`Found ${borrowerLoans.length} loans for ${address} from events`);
                }
              } catch (err) {
                // Silently continue
              }
            }
          }
        }
      } catch (err) {
        console.log('Failed to process event logs:', err);
      }
      
      console.log(`Total active loans found: ${activeLoans.length}`);
      return activeLoans;
    } catch (error) {
      console.error('Failed to get all active loans:', error);
      return [];
    }
  }

  // Repay with collateral
  async repayWithCollateral(loanId: number): Promise<any> {
    if (!this.lendingBank || !this.signer) {
      throw new Error('Contract not initialized or wallet not connected');
    }
    
    try {
      const loan = await this.lendingBank.getLoan(loanId);
      
      if (!loan.active) {
        throw new Error('This loan is no longer active');
      }
      
      const tokenType = Number(loan.tokenType);
      
      if (typeof this.lendingBank.repayWithCollateral === 'function') {
        const contractCall = () => this.lendingBank!.repayWithCollateral(loanId);
        
        const receipt = await this.executeTransaction(
          contractCall,
          'Repay with Collateral'
        );
        
        console.log('Repayment with collateral successful:', receipt);
        
        const userAddress = await this.signer.getAddress();
        this.addToTransactionHistory({
          id: `repay-collateral-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          type: 'repay',
          loanId: loanId,
          borrower: userAddress,
          tokenType: tokenType,
          tokenName: this.getTokenNameByType(tokenType),
          tokenAmount: ethers.formatEther(loan.tokenAmount),
          collateralAmount: ethers.formatEther(loan.collateralAmount),
          timestamp: Math.floor(Date.now() / 1000),
          date: new Date().toLocaleString()
        });
        
        return receipt;
      } else {
        throw new Error(
          "Direct repayment with collateral isn't supported by the smart contract. " +
          "In a production DeFi app, this would use an integrated DEX to swap collateral for tokens."
        );
      }
    } catch (error) {
      console.error('Failed to repay loan with collateral:', error);
      throw error;
    }
  }

  // ==================== TRANSACTION HISTORY METHODS ====================

  // Get transaction history
  getTransactionHistory(userAddress?: string): TransactionHistory[] {
    if (!userAddress) {
      return this.transactionHistory;
    }
    
    return this.transactionHistory.filter(tx => 
      tx.borrower.toLowerCase() === userAddress.toLowerCase()
    );
  }
  
  // Add transaction to history and save to localStorage
  private addToTransactionHistory(transaction: TransactionHistory): void {
    this.transactionHistory.push(transaction);
    this.saveTransactionHistory();
  }
  
  // Save transaction history to localStorage
  private saveTransactionHistory(): void {
    try {
      localStorage.setItem('defi_transaction_history', JSON.stringify(this.transactionHistory));
    } catch (error) {
      console.error('Failed to save transaction history:', error);
    }
  }
  
  // Load transaction history from localStorage
  private loadTransactionHistory(): void {
    try {
      const savedHistory = localStorage.getItem('defi_transaction_history');
      if (savedHistory) {
        this.transactionHistory = JSON.parse(savedHistory);
      }
    } catch (error) {
      console.error('Failed to load transaction history:', error);
    }
  }

  // ==================== UTILITY METHODS ====================

  // Get token name by type index
  private getTokenNameByType(tokenType: number): string {
    const names = [
      'Stable Loan Token',
      'Standard Loan Token',
      'Premium Loan Token',
      'Mega Loan Token'
    ];
    
    return names[tokenType] || 'Unknown Token';
  }

  // Calculate time remaining until deadline
  private calculateTimeRemaining(deadline: number): string {
    const now = Math.floor(Date.now() / 1000);
    const remaining = deadline - now;
    
    if (remaining <= 0) {
      return 'Expired';
    }
    
    const days = Math.floor(remaining / (24 * 60 * 60));
    const hours = Math.floor((remaining % (24 * 60 * 60)) / (60 * 60));
    
    return `${days}d ${hours}h`;
  }

  // Helper function to get token name
  private getTokenName(key: string): string {
    const names: Record<string, string> = {
      stable: 'Stable Loan Token',
      standard: 'Standard Loan Token',
      premium: 'Premium Loan Token',
      mega: 'Mega Loan Token'
    };
    
    return names[key] || 'Unknown Token';
  }

  // ==================== NEW ML UTILITY METHODS ====================

  // Set ML API URL
  setMLAPIUrl(url: string): void {
    this.mlApiUrl = url;
  }

  // Set ML API timeout
  setMLAPITimeout(timeout: number): void {
    this.mlApiTimeout = timeout;
  }

  // Generate sample activity pattern for testing
  generateSampleActivityPattern(chronotype: 'early' | 'intermediate' | 'late' = 'intermediate'): number[] {
    const pattern = new Array(24).fill(0);
    
    switch (chronotype) {
      case 'early':
        // High activity 6-10 AM, medium 11-17, low 18-22, very low 23-5
        for (let i = 0; i < 24; i++) {
          if (i >= 6 && i <= 10) pattern[i] = 800 + Math.random() * 200;
          else if (i >= 11 && i <= 17) pattern[i] = 400 + Math.random() * 200;
          else if (i >= 18 && i <= 22) pattern[i] = 200 + Math.random() * 100;
          else pattern[i] = 50 + Math.random() * 50;
        }
        break;
      case 'late':
        // Low morning, medium afternoon, high evening/night
        for (let i = 0; i < 24; i++) {
          if (i >= 6 && i <= 12) pattern[i] = 100 + Math.random() * 100;
          else if (i >= 13 && i <= 18) pattern[i] = 400 + Math.random() * 200;
          else if (i >= 19 || i <= 2) pattern[i] = 800 + Math.random() * 200;
          else pattern[i] = 50 + Math.random() * 50;
        }
        break;
      default: // intermediate
        // Balanced pattern with peak in middle of day
        for (let i = 0; i < 24; i++) {
          if (i >= 9 && i <= 17) pattern[i] = 600 + Math.random() * 300;
          else if (i >= 6 && i <= 8 || i >= 18 && i <= 22) pattern[i] = 300 + Math.random() * 200;
          else pattern[i] = 100 + Math.random() * 100;
        }
    }
    
    return pattern;
  }

  // Validate activity pattern
  validateActivityPattern(pattern: number[]): boolean {
    if (!Array.isArray(pattern)) return false;
    if (pattern.length < 24) return false;
    return pattern.every(value => typeof value === 'number' && value >= 0);
  }
}

// Export singleton instance
const contractService = new ContractService();
export default contractService;
