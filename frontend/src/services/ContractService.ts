import { ethers } from 'ethers';
import LendingBankABI from '../contracts/abis/LendingBank.json';
import StableLoanTokenABI from '../contracts/abis/StableLoanToken.json';
import StandardLoanTokenABI from '../contracts/abis/StandardLoanToken.json';
import PremiumLoanTokenABI from '../contracts/abis/PremiumLoanToken.json';
import MegaLoanTokenABI from '../contracts/abis/MegaLoanToken.json';
import localDeployment from '../contracts/addresses/localhost-deployment.json';

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
      // If no address provided, use the connected wallet
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
  
  // Update getTokenStatistics method with this more accurate approach
async getTokenStatistics(): Promise<TokenStatistics[]> {
  if (!this.lendingBank) {
    throw new Error('LendingBank contract not initialized');
  }
  
  try {
    const statsPromises = Object.entries(this.tokens).map(async ([key, contract], index) => {
      // Total supply is the balance of the lending bank
      const bankAddress = await this.lendingBank!.getAddress();
      const totalSupply = await contract.balanceOf(bankAddress);
      
      // Calculate total borrowed by summing ACTIVE loans for this token type
      let totalBorrowed = ethers.parseEther("0");
      
      try {
        // First attempt: Use contract's native method if available
        totalBorrowed = await this.lendingBank!.getTotalBorrowedForToken(index);
      } catch (err) {
        try {
          // Second attempt: Calculate from active loans
          console.log('Using active loans to calculate borrowed amount');
          const activeLoans = await this.getAllActiveLoans();
          const tokenBorrowed = activeLoans
            .filter(loan => loan.tokenType === index)
            .reduce((sum, loan) => sum + parseFloat(loan.tokenAmount), 0);
          
          totalBorrowed = ethers.parseEther(tokenBorrowed.toString());
        } catch (innerErr) {
          // Last resort: Transaction history with both borrow and repay
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
          
          // Ensure we don't go negative
          borrowedAmount = Math.max(0, borrowedAmount);
          totalBorrowed = ethers.parseEther(borrowedAmount.toString());
        }
      }
      
      const totalSupplyETH = ethers.formatEther(totalSupply);
      const totalBorrowedETH = ethers.formatEther(totalBorrowed);
      const availableLiquidity = Math.max(0, parseFloat(totalSupplyETH) - parseFloat(totalBorrowedETH));
      
      // Calculate utilization rate
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


  // Borrow tokens method
  async borrowTokens(
    tokenType: number, 
    tokenAmount: string, 
    collateralAmount: string
  ): Promise<any> {
    if (!this.lendingBank || !this.signer) {
      throw new Error('Contract not initialized or wallet not connected');
    }
    
    try {
      // Convert string amounts to wei
      const tokenAmountWei = ethers.parseEther(tokenAmount);
      const collateralAmountWei = ethers.parseEther(collateralAmount);
      
      // Call deposit and borrow function with ETH
      const tx = await this.lendingBank.depositAndBorrow(
        tokenType,
        tokenAmountWei,
        { value: collateralAmountWei }
      );
      
      // Wait for transaction to be mined
      const receipt = await tx.wait();
      console.log('Borrow transaction successful:', receipt);
      
      // Add to transaction history
      const borrowerAddress = await this.signer.getAddress();
      
      this.addToTransactionHistory({
        id: `borrow-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        type: 'borrow',
        loanId: this.transactionHistory.length + 1, // This is an approximation, ideally get from event
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
      if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
        throw new Error('Transaction would fail: The operation may require more gas than expected.');
      }
      throw error;
    }
  }

  // Get user loans - MODIFIED to filter out inactive loans
  async getUserLoans(userAddress?: string): Promise<LoanInfo[]> {
    if (!this.lendingBank || !this.provider) {
      throw new Error('LendingBank contract not initialized');
    }
    
    try {
      // If no address provided, use the connected wallet
      const address = userAddress || (this.signer ? await this.signer.getAddress() : null);
      
      if (!address) {
        throw new Error('No user address provided and no wallet connected');
      }
      
      // Get loan IDs for the user
      const loanIds = await this.lendingBank.getUserLoans(address);
      
      if (loanIds.length === 0) {
        return [];
      }
      
      // Get details for each loan
      const loanPromises = loanIds.map(async (id: bigint) => {
        const loan = await this.lendingBank?.getLoan(id);
        
        // Calculate formatted values
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
      
      // Filter to only return active loans
      return allLoans.filter(loan => loan.active);
    } catch (error) {
      console.error('Failed to get user loans:', error);
      throw error;
    }
  }

  // Repay a loan - IMPROVED with robust error handling and automatic retry
async repayLoan(loanId: number, retryCount: number = 0): Promise<any> {
  if (!this.lendingBank || !this.signer) {
    throw new Error('Contract not initialized or wallet not connected');
  }
  
  try {
    // Get loan details
    const loan = await this.lendingBank.getLoan(loanId);
    
    if (!loan || !loan.active) {
      throw new Error('This loan is no longer active or could not be found');
    }
    
    // Get token contract for the loan
    const tokenType = Number(loan.tokenType);
    const tokenKeys = ['stable', 'standard', 'premium', 'mega'];
    const tokenKey = tokenKeys[tokenType];
    const tokenContract = this.tokens[tokenKey];
    
    if (!tokenContract) {
      throw new Error(`Token contract not found for type ${tokenType}`);
    }
    
    // Check current token balance with better error handling
    const userAddress = await this.signer.getAddress();
    let balance;
    try {
      balance = await tokenContract.balanceOf(userAddress);
    } catch (err) {
      throw new Error(`Failed to check token balance: ${err instanceof Error ? err.message : String(err)}`);
    }
    
    // Calculate total due with improved error handling
    let totalDue;
    let interestAmount;
    try {
      interestAmount = await this.lendingBank.calculateInterest(loanId);
      totalDue = loan.tokenAmount + interestAmount;
    } catch (err) {
      throw new Error(`Failed to calculate total due amount: ${err instanceof Error ? err.message : String(err)}`);
    }
    
    // Enhanced insufficient funds error with detailed information
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
    
    // CRITICAL IMPROVEMENT: Approve tokens for repayment with confirmation wait
    console.log(`Approving ${ethers.formatEther(totalDue)} tokens for repayment`);
    let approvalReceipt;
    
    try {
      const approveTx = await tokenContract.approve(
        await this.lendingBank.getAddress(),
        totalDue
      );
      
      // Wait for approval with confirmation
      approvalReceipt = await approveTx.wait(1);
      
      if (!approvalReceipt || approvalReceipt.status !== 1) {
        throw new Error("Token approval transaction failed. Please try again.");
      }
      
      console.log("Token approval confirmed:", approvalReceipt.hash);
      
      // CRITICAL IMPROVEMENT: Add delay to ensure approval is recognized by blockchain
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (err) {
      console.error("Approval failed:", err);
      throw new Error(`Failed to approve tokens for repayment: ${err instanceof Error ? err.message : String(err)}`);
    }
    
    // Execute repayment with improved error handling
    try {
      console.log("Executing repayment transaction...");
      const tx = await this.lendingBank.repay(loanId);
      const receipt = await tx.wait(1); // Wait for confirmation
      
      if (!receipt || receipt.status !== 1) {
        throw new Error("Repayment transaction failed. Please try again.");
      }
      
      console.log('Repayment successful:', receipt.hash);
      
      // Add to transaction history
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
    } catch (err) {
      // CRITICAL IMPROVEMENT: Automatic retry on first failure
      if (retryCount === 0) {
        console.log("First repayment attempt failed, retrying once...");
        await new Promise(resolve => setTimeout(resolve, 3000));
        return this.repayLoan(loanId, 1);
      }
      
      // Better error handling to avoid JSON structure issues
      let errorMessage = "Failed to repay loan";
      
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'object' && err !== null) {
        try {
          errorMessage = JSON.stringify(err);
        } catch (jsonErr) {
          errorMessage = String(err);
        }
      } else {
        errorMessage = String(err);
      }
      
      throw new Error(`Repayment failed: ${errorMessage}`);
    }
  } catch (error) {
    console.error('Failed to repay loan:', error);
    
    // Preserve custom error structure for specific error types
    if (error && typeof error === 'object' && 'code' in error) {
      throw error;
    }
    
    // Sanitize error message to prevent JSON structure issues
    let errorMessage = "An unknown error occurred during repayment";
    
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (error === null) {
      errorMessage = "Null error received from blockchain";
    } else if (typeof error === 'object') {
      try {
        // Create a properly typed object for the cleanup
        const cleanError: Record<string, any> = {};
        
        // Now TypeScript knows this object can have string keys
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

  
  // Add this method to ContractService
  async getTotalCollateral(): Promise<string> {
    if (!this.lendingBank) {
      throw new Error('LendingBank contract not initialized');
    }
    
    try {
      // Check if contract has a method to get total collateral
      if (typeof this.lendingBank.getTotalCollateral === 'function') {
        const totalCollateral = await this.lendingBank.getTotalCollateral();
        return ethers.formatEther(totalCollateral);
      } else {
        // Fallback: Calculate by summing all active loans
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

  private async getAllActiveLoans(): Promise<LoanInfo[]> {
    if (!this.lendingBank || !this.provider) {
      throw new Error('LendingBank contract not initialized');
    }
    
    try {
      const activeLoans: LoanInfo[] = [];
      const processedBorrowers = new Set<string>();
      
      // 1. First try to get loans for the connected wallet user
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
      
      // 2. Try to find other borrowers from transaction history
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
      
      // 3. Try to query recent events (if possible) to find more borrowers
      try {
        // Create a filter for loan events from the last week
        const currentBlock = await this.provider.getBlockNumber();
        const lookbackBlocks = 1000; // Adjust based on your network/needs
        const fromBlock = Math.max(0, currentBlock - lookbackBlocks);
        
        const eventsFilter = {
          address: await this.lendingBank.getAddress(),
          fromBlock: fromBlock,
          toBlock: 'latest'
        };
        
        const events = await this.provider.getLogs(eventsFilter);
        console.log(`Found ${events.length} contract events to check for borrowers`);
        
        // Look for any addresses in the event data that might be borrowers
        for (const event of events) {
          // Try to extract potential address from event topics (typically in position 1 or 2)
          const possibleAddresses = [];
          
          // Check topic 1 (often the first parameter)
          if (event.topics && event.topics.length > 1) {
            const topic1 = event.topics[1];
            if (topic1 && topic1.length >= 66) {
              // Extract the last 40 characters (20 bytes) which might be an address
              const potentialAddress = '0x' + topic1.slice(26);
              if (ethers.isAddress(potentialAddress)) {
                possibleAddresses.push(potentialAddress);
              }
            }
          }
          
          // Check topic 2 (second parameter)
          if (event.topics && event.topics.length > 2) {
            const topic2 = event.topics[2];
            if (topic2 && topic2.length >= 66) {
              const potentialAddress = '0x' + topic2.slice(26);
              if (ethers.isAddress(potentialAddress)) {
                possibleAddresses.push(potentialAddress);
              }
            }
          }
          
          // For each potential address, check if it has loans
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
                // Silently continue - this is speculative
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
      return []; // Return empty array on failure instead of throwing
    }
  }
  

  // Add this method to ContractService
  async repayWithCollateral(loanId: number): Promise<any> {
    if (!this.lendingBank || !this.signer) {
      throw new Error('Contract not initialized or wallet not connected');
    }
    
    try {
      // Get loan details
      const loan = await this.lendingBank.getLoan(loanId);
      
      if (!loan.active) {
        throw new Error('This loan is no longer active');
      }
      
      const tokenType = Number(loan.tokenType);
      
      // In a real DeFi application, this would interact with a DEX
      // For our prototype, we'll simulate a swap by using a repayWithCollateral function
      
      // Check if contract has this functionality directly
      if (typeof this.lendingBank.repayWithCollateral === 'function') {
        // Use contract's built-in function if available
        const tx = await this.lendingBank.repayWithCollateral(loanId);
        const receipt = await tx.wait();
        console.log('Repayment with collateral successful:', receipt);
        
        // Add to transaction history
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
        // If not available in contract, explain to user
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


  // Get transaction history
  getTransactionHistory(userAddress?: string): TransactionHistory[] {
    // If no address provided, return all transactions
    if (!userAddress) {
      return this.transactionHistory;
    }
    
    // Filter transactions for the specified user
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

  // Helper functions
  private getTokenName(key: string): string {
    const names: Record<string, string> = {
      stable: 'Stable Loan Token',
      standard: 'Standard Loan Token',
      premium: 'Premium Loan Token',
      mega: 'Mega Loan Token'
    };
    
    return names[key] || 'Unknown Token';
  }
}

// Export singleton instance
const contractService = new ContractService();
export default contractService;
