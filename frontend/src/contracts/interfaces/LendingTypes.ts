// Common types used across contracts
export interface Loan {
    borrower: string;
    collateralAmount: bigint;
    tokenType: number;
    tokenAmount: bigint;
    issuanceTimestamp: bigint;
    deadline: bigint;
    interestAccrued: bigint;
    active: boolean;
  }
  
  export interface LendingBankInterface {
    // Read methods
    getSupportedTokenCount(): Promise<bigint>;
    testMode(): Promise<boolean>;
    supportedTokens(index: number): Promise<string>;
    getLoan(loanId: number): Promise<Loan>;
    getUserLoans(user: string): Promise<bigint[]>;
    calculateInterest(loanId: number): Promise<bigint>;
    calculatePenalty(loanId: number): Promise<bigint>;
    isPastDue(loanId: number): Promise<boolean>;
    
    // Write methods
    depositAndBorrow(tokenType: number, tokenAmount: bigint, options: {value: bigint}): Promise<any>;
    repay(loanId: number): Promise<any>;
    forfeitLoan(loanId: number): Promise<any>;
  }
  
  export interface LoanTokenInterface {
    // Read methods
    tokenValue(): Promise<bigint>;
    interestRate(): Promise<bigint>;
    balanceOf(account: string): Promise<bigint>;
    allowance(owner: string, spender: string): Promise<bigint>;
    
    // Write methods
    approve(spender: string, amount: bigint): Promise<any>;
    transfer(to: string, amount: bigint): Promise<any>;
  }
  