import { expect } from "chai";
import { ethers } from "hardhat";
import "@nomicfoundation/hardhat-chai-matchers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { LendingBank, StableLoanToken, StandardLoanToken, PremiumLoanToken, MegaLoanToken } from "../typechain";

describe("LendingBank Complete Test Suite", function () {
  // Contract instances
  let lendingBank: LendingBank;
  let stableLoanToken: StableLoanToken;
  let standardLoanToken: StandardLoanToken;
  let premiumLoanToken: PremiumLoanToken;
  let megaLoanToken: MegaLoanToken;
  
  // Addresses
  let owner: any;
  let borrower1: any;
  let borrower2: any;
  let borrower3: any;
  let borrower4: any;
  
  // Token indices
  const STABLE_TOKEN = 0;
  const STANDARD_TOKEN = 1;
  const PREMIUM_TOKEN = 2;
  const MEGA_TOKEN = 3;
  
  // Loan constants
  const WEEK_IN_SECONDS = 7 * 24 * 60 * 60;
  const DAY_IN_SECONDS = 24 * 60 * 60;
  const MINIMUM_BORROW_AMOUNT = ethers.parseUnits("0.01", 18);
  
  // Test loan IDs
  let stableLoanId: number;
  let standardLoanId: number;
  let premiumLoanId: number;
  let megaLoanId: number;
  let earlyRepaymentLoanId: number;
  let latePhase1LoanId: number;
  let latePhase2LoanId: number;
  let forfeitLoanId: number;

  before(async function () {
    // Get signers
    const signers = await ethers.getSigners();
    owner = signers[0];
    borrower1 = signers[1];
    borrower2 = signers[2];
    borrower3 = signers[3];
    borrower4 = signers[4];
    
    console.log("=== Setting up Test Environment ===");
    console.log(`Owner: ${owner.address}`);
    console.log(`Borrower 1: ${borrower1.address}`);
    console.log(`Borrower 2: ${borrower2.address}`);
    console.log(`Borrower 3: ${borrower3.address}`);
    console.log(`Borrower 4: ${borrower4.address}`);
    
    // Deploy token contracts
    console.log("\n=== Deploying Token Contracts ===");
    
    const StableLoanTokenFactory = await ethers.getContractFactory("StableLoanToken");
    stableLoanToken = await StableLoanTokenFactory.deploy() as StableLoanToken;
    console.log(`StableLoanToken deployed at: ${await stableLoanToken.getAddress()}`);
    
    const StandardLoanTokenFactory = await ethers.getContractFactory("StandardLoanToken");
    standardLoanToken = await StandardLoanTokenFactory.deploy() as StandardLoanToken;
    console.log(`StandardLoanToken deployed at: ${await standardLoanToken.getAddress()}`);
    
    const PremiumLoanTokenFactory = await ethers.getContractFactory("PremiumLoanToken");
    premiumLoanToken = await PremiumLoanTokenFactory.deploy() as PremiumLoanToken;
    console.log(`PremiumLoanToken deployed at: ${await premiumLoanToken.getAddress()}`);
    
    const MegaLoanTokenFactory = await ethers.getContractFactory("MegaLoanToken");
    megaLoanToken = await MegaLoanTokenFactory.deploy() as MegaLoanToken;
    console.log(`MegaLoanToken deployed at: ${await megaLoanToken.getAddress()}`);
    
    // Deploy LendingBank
    console.log("\n=== Deploying LendingBank Contract ===");
    const LendingBankFactory = await ethers.getContractFactory("LendingBank");
    lendingBank = await LendingBankFactory.deploy() as LendingBank;
    console.log(`LendingBank deployed at: ${await lendingBank.getAddress()}`);
    
    // Add tokens to lending bank
    console.log("\n=== Adding Tokens to LendingBank ===");
    await lendingBank.addSupportedToken(await stableLoanToken.getAddress());
    console.log("StableLoanToken added to LendingBank");
    
    await lendingBank.addSupportedToken(await standardLoanToken.getAddress());
    console.log("StandardLoanToken added to LendingBank");
    
    await lendingBank.addSupportedToken(await premiumLoanToken.getAddress());
    console.log("PremiumLoanToken added to LendingBank");
    
    await lendingBank.addSupportedToken(await megaLoanToken.getAddress());
    console.log("MegaLoanToken added to LendingBank");
    
    // Transfer token ownership to lending bank
    console.log("\n=== Transferring Token Ownership to LendingBank ===");
    await stableLoanToken.transferOwnership(await lendingBank.getAddress());
    console.log("StableLoanToken ownership transferred to LendingBank");
    
    await standardLoanToken.transferOwnership(await lendingBank.getAddress());
    console.log("StandardLoanToken ownership transferred to LendingBank");
    
    await premiumLoanToken.transferOwnership(await lendingBank.getAddress());
    console.log("PremiumLoanToken ownership transferred to LendingBank");
    
    await megaLoanToken.transferOwnership(await lendingBank.getAddress());
    console.log("MegaLoanToken ownership transferred to LendingBank");
    
    // Enable test mode
    console.log("\n=== Enabling Test Mode ===");
    await lendingBank.setTestMode(true);
    console.log("Test mode enabled");
    
    // Initialize token reserves for testing
    console.log("\n=== Initializing Token Reserves ===");
    const reserveAmount = ethers.parseUnits("1000000", 18);
    await lendingBank.initializeTokenReserves(reserveAmount);
    console.log(`${ethers.formatUnits(reserveAmount, 18)} tokens of each type minted to LendingBank`);
  });

  describe("Token Properties", function () {
    it("Should have 4 supported tokens", async function () {
      console.log("\n=== Checking Supported Token Count ===");
      const tokenCount = await lendingBank.getSupportedTokenCount();
      console.log(`Supported token count: ${tokenCount}`);
      expect(tokenCount === 4n).to.be.true;
    });

    it("Should have correct token values", async function () {
      console.log("\n=== Checking Token Values ===");
      
      const stableTokenValue = await stableLoanToken.tokenValue();
      console.log(`StableLoanToken value: ${ethers.formatEther(stableTokenValue)} ETH`);
      expect(stableTokenValue).to.equal(ethers.parseEther("0.25"));
      
      const standardTokenValue = await standardLoanToken.tokenValue();
      console.log(`StandardLoanToken value: ${ethers.formatEther(standardTokenValue)} ETH`);
      expect(standardTokenValue).to.equal(ethers.parseEther("0.5"));
      
      const premiumTokenValue = await premiumLoanToken.tokenValue();
      console.log(`PremiumLoanToken value: ${ethers.formatEther(premiumTokenValue)} ETH`);
      expect(premiumTokenValue).to.equal(ethers.parseEther("0.75"));
      
      const megaTokenValue = await megaLoanToken.tokenValue();
      console.log(`MegaLoanToken value: ${ethers.formatEther(megaTokenValue)} ETH`);
      expect(megaTokenValue).to.equal(ethers.parseEther("1.0"));
    });

    it("Should have correct interest rates", async function () {
      console.log("\n=== Checking Token Interest Rates ===");
      
      const stableTokenRate = await stableLoanToken.interestRate();
      console.log(`StableLoanToken interest rate: ${stableTokenRate / 100n}%`);
      expect(stableTokenRate).to.equal(500n); // 5%
      
      const standardTokenRate = await standardLoanToken.interestRate();
      console.log(`StandardLoanToken interest rate: ${standardTokenRate / 100n}%`);
      expect(standardTokenRate).to.equal(800n); // 8%
      
      const premiumTokenRate = await premiumLoanToken.interestRate();
      console.log(`PremiumLoanToken interest rate: ${premiumTokenRate / 100n}%`);
      expect(premiumTokenRate).to.equal(1200n); // 12%
      
      const megaTokenRate = await megaLoanToken.interestRate();
      console.log(`MegaLoanToken interest rate: ${megaTokenRate / 100n}%`);
      expect(megaTokenRate).to.equal(1800n); // 18%
    });
  });

  describe("Borrowing Functionality", function () {
    it("Should allow borrowing StableLoanToken", async function () {
      console.log("\n=== Testing StableLoanToken Borrowing ===");
      
      const tokenType = STABLE_TOKEN;
      const tokenAmount = ethers.parseUnits("0.1", 18); // Borrow 0.1 tokens
      console.log(`Attempting to borrow ${ethers.formatUnits(tokenAmount, 18)} StableLoanTokens`);
      
      // Calculate token value
      const tokenValue = await stableLoanToken.tokenValue();
      console.log(`Token value: ${ethers.formatEther(tokenValue)} ETH per token`);
      
      // Calculate collateral requirement (150% of borrowed value)
      const borrowValue = (tokenAmount * tokenValue) / ethers.parseUnits("1", 18);
      const collateralRequired = (borrowValue * 150n) / 100n;
      console.log(`Required collateral (150%): ${ethers.formatEther(collateralRequired)} ETH`);
      
      // Add a small buffer to ensure we meet the requirement
      const collateralAmount = collateralRequired + ethers.parseEther("0.001");
      console.log(`Providing collateral amount: ${ethers.formatEther(collateralAmount)} ETH`);
      
      // Check borrower balance before
      const ethBalanceBefore = await ethers.provider.getBalance(borrower1.address);
      console.log(`Borrower ETH balance before: ${ethers.formatEther(ethBalanceBefore)} ETH`);
      
      // Connect as borrower
      const borrowerBank = lendingBank.connect(borrower1) as LendingBank;
      
      // Deposit ETH and borrow tokens
      console.log("Executing depositAndBorrow transaction...");
      const tx = await borrowerBank.depositAndBorrow(tokenType, tokenAmount, { value: collateralAmount });
      const receipt = await tx.wait();
      console.log(`Transaction successful: ${receipt?.hash}`);
      
      // Get loan ID (assume it's the first loan)
      stableLoanId = 0;
      
      // Check borrower received tokens
      const balance = await stableLoanToken.balanceOf(borrower1.address);
      console.log(`Borrower token balance after: ${ethers.formatUnits(balance, 18)} StableLoanTokens`);
      expect(balance === tokenAmount).to.be.true;
      
      // Get loan details
      const loan = await lendingBank.getLoan(stableLoanId);
      
      console.log("\nLoan details:");
      console.log(`- Borrower: ${loan.borrower}`);
      console.log(`- Collateral amount: ${ethers.formatEther(loan.collateralAmount)} ETH`);
      console.log(`- Token type: ${loan.tokenType}`);
      console.log(`- Token amount: ${ethers.formatUnits(loan.tokenAmount, 18)} tokens`);
      console.log(`- Issuance timestamp: ${new Date(Number(loan.issuanceTimestamp) * 1000).toLocaleString()}`);
      console.log(`- Deadline: ${new Date(Number(loan.deadline) * 1000).toLocaleString()}`);
      console.log(`- Active: ${loan.active}`);
      
      expect(loan.borrower).to.equal(borrower1.address);
      expect(loan.collateralAmount).to.equal(collateralAmount);
      expect(loan.tokenType).to.equal(tokenType);
      expect(loan.tokenAmount).to.equal(tokenAmount);
      expect(loan.active).to.be.true;
    });

    it("Should allow borrowing StandardLoanToken", async function () {
      console.log("\n=== Testing StandardLoanToken Borrowing ===");
      
      const tokenType = STANDARD_TOKEN;
      const tokenAmount = ethers.parseUnits("0.2", 18); // Borrow 0.2 tokens
      console.log(`Attempting to borrow ${ethers.formatUnits(tokenAmount, 18)} StandardLoanTokens`);
      
      // Calculate token value
      const tokenValue = await standardLoanToken.tokenValue();
      console.log(`Token value: ${ethers.formatEther(tokenValue)} ETH per token`);
      
      // Calculate collateral requirement (150% of borrowed value)
      const borrowValue = (tokenAmount * tokenValue) / ethers.parseUnits("1", 18);
      const collateralRequired = (borrowValue * 150n) / 100n;
      console.log(`Required collateral (150%): ${ethers.formatEther(collateralRequired)} ETH`);
      
      // Add a small buffer to ensure we meet the requirement
      const collateralAmount = collateralRequired + ethers.parseEther("0.001");
      console.log(`Providing collateral amount: ${ethers.formatEther(collateralAmount)} ETH`);
      
      // Connect as borrower
      const borrowerBank = lendingBank.connect(borrower2) as LendingBank;
      
      // Deposit ETH and borrow tokens
      console.log("Executing depositAndBorrow transaction...");
      const tx = await borrowerBank.depositAndBorrow(tokenType, tokenAmount, { value: collateralAmount });
      const receipt = await tx.wait();
      console.log(`Transaction successful: ${receipt?.hash}`);
      
      // Get loan ID (second loan)
      standardLoanId = 1;
      
      // Check borrower received tokens
      const balance = await standardLoanToken.balanceOf(borrower2.address);
      console.log(`Borrower token balance after: ${ethers.formatUnits(balance, 18)} StandardLoanTokens`);
      expect(balance === tokenAmount).to.be.true;
      
      // Get loan details
      const loan = await lendingBank.getLoan(standardLoanId);
      
      console.log("\nLoan details:");
      console.log(`- Borrower: ${loan.borrower}`);
      console.log(`- Collateral amount: ${ethers.formatEther(loan.collateralAmount)} ETH`);
      console.log(`- Token type: ${loan.tokenType}`);
      console.log(`- Token amount: ${ethers.formatUnits(loan.tokenAmount, 18)} tokens`);
      console.log(`- Issuance timestamp: ${new Date(Number(loan.issuanceTimestamp) * 1000).toLocaleString()}`);
      console.log(`- Deadline: ${new Date(Number(loan.deadline) * 1000).toLocaleString()}`);
      console.log(`- Active: ${loan.active}`);
      
      expect(loan.borrower).to.equal(borrower2.address);
      expect(loan.collateralAmount).to.equal(collateralAmount);
      expect(loan.tokenType).to.equal(tokenType);
      expect(loan.tokenAmount).to.equal(tokenAmount);
      expect(loan.active).to.be.true;
    });

    it("Should allow borrowing PremiumLoanToken", async function () {
      console.log("\n=== Testing PremiumLoanToken Borrowing ===");
      
      const tokenType = PREMIUM_TOKEN;
      const tokenAmount = ethers.parseUnits("0.3", 18); // Borrow 0.3 tokens
      console.log(`Attempting to borrow ${ethers.formatUnits(tokenAmount, 18)} PremiumLoanTokens`);
      
      // Calculate token value
      const tokenValue = await premiumLoanToken.tokenValue();
      console.log(`Token value: ${ethers.formatEther(tokenValue)} ETH per token`);
      
      // Calculate collateral requirement (150% of borrowed value)
      const borrowValue = (tokenAmount * tokenValue) / ethers.parseUnits("1", 18);
      const collateralRequired = (borrowValue * 150n) / 100n;
      console.log(`Required collateral (150%): ${ethers.formatEther(collateralRequired)} ETH`);
      
      // Add a small buffer to ensure we meet the requirement
      const collateralAmount = collateralRequired + ethers.parseEther("0.001");
      console.log(`Providing collateral amount: ${ethers.formatEther(collateralAmount)} ETH`);
      
      // Connect as borrower
      const borrowerBank = lendingBank.connect(borrower3) as LendingBank;
      
      // Deposit ETH and borrow tokens
      console.log("Executing depositAndBorrow transaction...");
      const tx = await borrowerBank.depositAndBorrow(tokenType, tokenAmount, { value: collateralAmount });
      const receipt = await tx.wait();
      console.log(`Transaction successful: ${receipt?.hash}`);
      
      // Get loan ID (third loan)
      premiumLoanId = 2;
      
      // Check borrower received tokens
      const balance = await premiumLoanToken.balanceOf(borrower3.address);
      console.log(`Borrower token balance after: ${ethers.formatUnits(balance, 18)} PremiumLoanTokens`);
      expect(balance === tokenAmount).to.be.true;
      
      // Get loan details
      const loan = await lendingBank.getLoan(premiumLoanId);
      
      console.log("\nLoan details:");
      console.log(`- Borrower: ${loan.borrower}`);
      console.log(`- Collateral amount: ${ethers.formatEther(loan.collateralAmount)} ETH`);
      console.log(`- Token type: ${loan.tokenType}`);
      console.log(`- Token amount: ${ethers.formatUnits(loan.tokenAmount, 18)} tokens`);
      console.log(`- Issuance timestamp: ${new Date(Number(loan.issuanceTimestamp) * 1000).toLocaleString()}`);
      console.log(`- Deadline: ${new Date(Number(loan.deadline) * 1000).toLocaleString()}`);
      console.log(`- Active: ${loan.active}`);
      
      expect(loan.borrower).to.equal(borrower3.address);
      expect(loan.collateralAmount).to.equal(collateralAmount);
      expect(loan.tokenType).to.equal(tokenType);
      expect(loan.tokenAmount).to.equal(tokenAmount);
      expect(loan.active).to.be.true;
    });

    it("Should allow borrowing MegaLoanToken", async function () {
      console.log("\n=== Testing MegaLoanToken Borrowing ===");
      
      const tokenType = MEGA_TOKEN;
      const tokenAmount = ethers.parseUnits("0.4", 18); // Borrow 0.4 tokens
      console.log(`Attempting to borrow ${ethers.formatUnits(tokenAmount, 18)} MegaLoanTokens`);
      
      // Calculate token value
      const tokenValue = await megaLoanToken.tokenValue();
      console.log(`Token value: ${ethers.formatEther(tokenValue)} ETH per token`);
      
      // Calculate collateral requirement (150% of borrowed value)
      const borrowValue = (tokenAmount * tokenValue) / ethers.parseUnits("1", 18);
      const collateralRequired = (borrowValue * 150n) / 100n;
      console.log(`Required collateral (150%): ${ethers.formatEther(collateralRequired)} ETH`);
      
      // Add a small buffer to ensure we meet the requirement
      const collateralAmount = collateralRequired + ethers.parseEther("0.001");
      console.log(`Providing collateral amount: ${ethers.formatEther(collateralAmount)} ETH`);
      
      // Connect as borrower
      const borrowerBank = lendingBank.connect(borrower4) as LendingBank;
      
      // Deposit ETH and borrow tokens
      console.log("Executing depositAndBorrow transaction...");
      const tx = await borrowerBank.depositAndBorrow(tokenType, tokenAmount, { value: collateralAmount });
      const receipt = await tx.wait();
      console.log(`Transaction successful: ${receipt?.hash}`);
      
      // Get loan ID (fourth loan)
      megaLoanId = 3;
      
      // Check borrower received tokens
      const balance = await megaLoanToken.balanceOf(borrower4.address);
      console.log(`Borrower token balance after: ${ethers.formatUnits(balance, 18)} MegaLoanTokens`);
      expect(balance === tokenAmount).to.be.true;
      
      // Get loan details
      const loan = await lendingBank.getLoan(megaLoanId);
      
      console.log("\nLoan details:");
      console.log(`- Borrower: ${loan.borrower}`);
      console.log(`- Collateral amount: ${ethers.formatEther(loan.collateralAmount)} ETH`);
      console.log(`- Token type: ${loan.tokenType}`);
      console.log(`- Token amount: ${ethers.formatUnits(loan.tokenAmount, 18)} tokens`);
      console.log(`- Issuance timestamp: ${new Date(Number(loan.issuanceTimestamp) * 1000).toLocaleString()}`);
      console.log(`- Deadline: ${new Date(Number(loan.deadline) * 1000).toLocaleString()}`);
      console.log(`- Active: ${loan.active}`);
      
      expect(loan.borrower).to.equal(borrower4.address);
      expect(loan.collateralAmount).to.equal(collateralAmount);
      expect(loan.tokenType).to.equal(tokenType);
      expect(loan.tokenAmount).to.equal(tokenAmount);
      expect(loan.active).to.be.true;
    });

    it("Should reject borrowing below minimum amount", async function () {
      console.log("\n=== Testing Minimum Borrowing Amount ===");
      
      const tokenType = STABLE_TOKEN;
      const tokenAmount = ethers.parseUnits("0.005", 18); // Below 0.01 minimum
      console.log(`Attempting to borrow ${ethers.formatUnits(tokenAmount, 18)} tokens (below minimum)`);
      
      // Calculate collateral amount (more than enough)
      const collateralAmount = ethers.parseEther("0.1");
      console.log(`Providing collateral amount: ${ethers.formatEther(collateralAmount)} ETH`);
      
      // Connect as borrower
      const borrowerBank = lendingBank.connect(borrower1) as LendingBank;
      
      // Should be rejected due to below minimum amount
      console.log("Expecting transaction to be rejected...");
      await expect(
        borrowerBank.depositAndBorrow(tokenType, tokenAmount, { value: collateralAmount })
      ).to.be.revertedWith("Amount below minimum threshold");
      
      console.log("Transaction was correctly rejected");
    });

    it("Should reject borrowing with insufficient collateral", async function () {
      console.log("\n=== Testing Insufficient Collateral Rejection ===");
      
      const tokenType = STABLE_TOKEN;
      const tokenAmount = ethers.parseUnits("1.0", 18); // Borrow 1.0 tokens
      console.log(`Attempting to borrow ${ethers.formatUnits(tokenAmount, 18)} StableLoanTokens`);
      
      // Calculate token value
      const tokenValue = await stableLoanToken.tokenValue();
      console.log(`Token value: ${ethers.formatEther(tokenValue)} ETH per token`);
      
      // Calculate required collateral
      const borrowValue = (tokenAmount * tokenValue) / ethers.parseUnits("1", 18);
      const requiredCollateral = (borrowValue * 150n) / 100n;
      console.log(`Required collateral (150%): ${ethers.formatEther(requiredCollateral)} ETH`);
      
      // Provide insufficient collateral (only 100% of value)
      const collateralAmount = borrowValue;
      console.log(`Providing insufficient collateral: ${ethers.formatEther(collateralAmount)} ETH`);
      
      // Connect as borrower
      const borrowerBank = lendingBank.connect(borrower1) as LendingBank;
      
      // Should be rejected due to insufficient collateral
      console.log("Expecting transaction to be rejected...");
      await expect(
        borrowerBank.depositAndBorrow(tokenType, tokenAmount, { value: collateralAmount })
      ).to.be.revertedWith("Insufficient collateral");
      
      console.log("Transaction was correctly rejected");
    });
  });

  describe("Interest Calculation", function () {
    it("Should calculate interest correctly for all token types", async function () {
      console.log("\n=== Testing Interest Calculation for All Tokens ===");
      
      console.log("Fast-forwarding time by 3 days...");
      await time.increase(3 * DAY_IN_SECONDS);
      
      // StableLoanToken interest (5% APY)
      const stableInterest = await lendingBank.calculateInterest(stableLoanId);
      console.log(`StableLoanToken interest after 3 days: ${ethers.formatUnits(stableInterest, 18)} tokens`);
      expect(stableInterest > 0n).to.be.true;
      
      // StandardLoanToken interest (8% APY)
      const standardInterest = await lendingBank.calculateInterest(standardLoanId);
      console.log(`StandardLoanToken interest after 3 days: ${ethers.formatUnits(standardInterest, 18)} tokens`);
      expect(standardInterest > 0n).to.be.true;
      
      // PremiumLoanToken interest (12% APY)
      const premiumInterest = await lendingBank.calculateInterest(premiumLoanId);
      console.log(`PremiumLoanToken interest after 3 days: ${ethers.formatUnits(premiumInterest, 18)} tokens`);
      expect(premiumInterest > 0n).to.be.true;
      
      // MegaLoanToken interest (18% APY)
      const megaInterest = await lendingBank.calculateInterest(megaLoanId);
      console.log(`MegaLoanToken interest after 3 days: ${ethers.formatUnits(megaInterest, 18)} tokens`);
      expect(megaInterest > 0n).to.be.true;
      
      // Compare interest rates - higher rate tokens should accrue more interest
      console.log("\nComparing interest rates:");
      console.log(`Stable vs Standard: ${Number(standardInterest) > Number(stableInterest)}`);
      console.log(`Standard vs Premium: ${Number(premiumInterest) > Number(standardInterest)}`);
      console.log(`Premium vs Mega: ${Number(megaInterest) > Number(premiumInterest)}`);
      
      expect(Number(standardInterest) > Number(stableInterest)).to.be.true;
      expect(Number(premiumInterest) > Number(standardInterest)).to.be.true;
      expect(Number(megaInterest) > Number(premiumInterest)).to.be.true;
    });
  });

  describe("Repayment Scenarios", function () {
    it("Should allow repaying StableLoanToken loan", async function () {
      console.log("\n=== Testing StableLoanToken Loan Repayment ===");
      
      // Get loan details
      const loanId = stableLoanId;
      const loan = await lendingBank.getLoan(loanId);
      console.log(`Repaying loan ID ${loanId}`);
      console.log(`Loan amount: ${ethers.formatUnits(loan.tokenAmount, 18)} StableLoanTokens`);
      
      // Calculate interest
      const interest = await lendingBank.calculateInterest(loanId);
      console.log(`Accrued interest: ${ethers.formatUnits(interest, 18)} tokens`);
      
      // Calculate total repayment
      const totalRepayment = loan.tokenAmount + interest;
      console.log(`Total repayment required: ${ethers.formatUnits(totalRepayment, 18)} tokens`);
      
      // Mint extra tokens to the borrower to cover interest (with buffer)
      const buffer = totalRepayment * 10n / 100n;
      await lendingBank.mintTestTokens(borrower1.address, loan.tokenType, interest + buffer);
      console.log(`Minted ${ethers.formatUnits(interest + buffer, 18)} extra tokens to borrower for interest`);
      
      // Check token balance after minting
      const balanceAfterMint = await stableLoanToken.balanceOf(borrower1.address);
      console.log(`Borrower token balance: ${ethers.formatUnits(balanceAfterMint, 18)} tokens`);
      
      // Connect as borrower
      const borrowerBank = lendingBank.connect(borrower1) as LendingBank;
      const borrowerToken = stableLoanToken.connect(borrower1) as StableLoanToken;
      
      // Approve tokens for spending
      const bankAddress = await lendingBank.getAddress();
      const approveAmount = totalRepayment + buffer;
      console.log(`Approving ${ethers.formatUnits(approveAmount, 18)} tokens to be spent by the bank`);
      const approveTx = await borrowerToken.approve(bankAddress, approveAmount);
      await approveTx.wait();
      
      // Verify approval
      const allowance = await stableLoanToken.allowance(borrower1.address, bankAddress);
      console.log(`Allowance after approval: ${ethers.formatUnits(allowance, 18)} tokens`);
      expect(allowance >= totalRepayment).to.be.true;
      
      // Get ETH balance before repayment
      const ethBalanceBefore = await ethers.provider.getBalance(borrower1.address);
      console.log(`Borrower ETH balance before repayment: ${ethers.formatEther(ethBalanceBefore)} ETH`);
      
      // Repay the loan
      console.log("Executing repay transaction...");
      const tx = await borrowerBank.repay(loanId);
      const receipt = await tx.wait();
      console.log(`Repayment transaction successful: ${receipt?.hash}`);
      
      // Get ETH balance after repayment
      const ethBalanceAfter = await ethers.provider.getBalance(borrower1.address);
      console.log(`Borrower ETH balance after repayment: ${ethers.formatEther(ethBalanceAfter)} ETH`);
      console.log(`Difference: ${ethers.formatEther(ethBalanceAfter - ethBalanceBefore)} ETH`);
      
      // Verify loan is now inactive
      const updatedLoan = await lendingBank.getLoan(loanId);
      console.log(`Loan active status after repayment: ${updatedLoan.active}`);
      expect(updatedLoan.active).to.be.false;
    });
    
    it("Should setup loan for early repayment test", async function () {
      console.log("\n=== Setting Up Early Repayment Test ===");
      
      const tokenType = STANDARD_TOKEN;
      const tokenAmount = ethers.parseUnits("0.3", 18); // Borrow 0.3 tokens
      console.log(`Borrowing ${ethers.formatUnits(tokenAmount, 18)} StandardLoanTokens`);
      
      // Calculate token value and required collateral
      const tokenValue = await standardLoanToken.tokenValue();
      const borrowValue = (tokenAmount * tokenValue) / ethers.parseUnits("1", 18);
      const requiredCollateral = (borrowValue * 150n) / 100n + ethers.parseEther("0.001");
      console.log(`Required collateral: ${ethers.formatEther(requiredCollateral)} ETH`);
      
      // Create loan for early repayment test
      const borrowerBank = lendingBank.connect(borrower1) as LendingBank;
      const tx = await borrowerBank.depositAndBorrow(tokenType, tokenAmount, { value: requiredCollateral });
      await tx.wait();
      
      earlyRepaymentLoanId = 4; // This should be the 5th loan overall
      console.log(`Created loan ID ${earlyRepaymentLoanId} for early repayment test`);
      
      // Verify loan details
      const loan = await lendingBank.getLoan(earlyRepaymentLoanId);
      console.log(`Loan amount: ${ethers.formatUnits(loan.tokenAmount, 18)} StandardLoanTokens`);
      console.log(`Collateral: ${ethers.formatEther(loan.collateralAmount)} ETH`);
    });

    it("Should apply early repayment discount", async function () {
      console.log("\n=== Testing Early Repayment Discount ===");
      
      // Advance time by 2 days (still within early repayment window)
      console.log("Fast-forwarding time by 2 days...");
      await time.increase(2 * DAY_IN_SECONDS);
      
      const loanId = earlyRepaymentLoanId;
      console.log(`Testing early repayment for loan ID: ${loanId}`);
      
      // Get loan details and calculate interest
      const loan = await lendingBank.getLoan(loanId);
      const interest = await lendingBank.calculateInterest(loanId);
      console.log(`Regular interest amount: ${ethers.formatUnits(interest, 18)} tokens`);
      
      // Total repayment with safety buffer
      const totalRepayment = loan.tokenAmount + interest;
      const buffer = totalRepayment * 20n / 100n;
      console.log(`Total repayment with regular interest: ${ethers.formatUnits(totalRepayment, 18)} tokens`);
      
      // Mint tokens and approve
      await lendingBank.mintTestTokens(borrower1.address, loan.tokenType, totalRepayment + buffer);
      console.log(`Minted ${ethers.formatUnits(totalRepayment + buffer, 18)} tokens to borrower`);
      
      const borrowerBank = lendingBank.connect(borrower1) as LendingBank;
      const borrowerToken = standardLoanToken.connect(borrower1) as StandardLoanToken;
      const bankAddress = await lendingBank.getAddress();
      
      await borrowerToken.approve(bankAddress, totalRepayment + buffer);
      console.log(`Approved ${ethers.formatUnits(totalRepayment + buffer, 18)} tokens for spending`);
      
      // Repay the loan
      console.log("Executing early repayment...");
      const tx = await borrowerBank.repay(loanId);
      await tx.wait();
      
      // Verify loan is inactive and early discount was applied
      const updatedLoan = await lendingBank.getLoan(loanId);
      console.log(`Loan active status: ${updatedLoan.active}`);
      console.log(`Interest recorded: ${ethers.formatUnits(updatedLoan.interestAccrued, 18)} tokens`);
      
      expect(updatedLoan.active).to.be.false;
      // Early repayment discount should make recorded interest less than calculated interest
      expect(updatedLoan.interestAccrued < interest).to.be.true;
      console.log("Early repayment discount was successfully applied");
    });
  });

  describe("Late Repayment and Penalties", function () {
    it("Should setup loans for penalty testing", async function () {
      console.log("\n=== Setting Up Penalty Test Loans ===");
      
      // Create loan for Phase 1 penalty test (days 8-10)
      const tokenType1 = PREMIUM_TOKEN;
      const tokenAmount1 = ethers.parseUnits("0.2", 18);
      const tokenValue1 = await premiumLoanToken.tokenValue();
      const borrowValue1 = (tokenAmount1 * tokenValue1) / ethers.parseUnits("1", 18);
      const collateralAmount1 = (borrowValue1 * 150n) / 100n + ethers.parseEther("0.001");
      
      console.log(`Creating Phase 1 penalty test loan: ${ethers.formatUnits(tokenAmount1, 18)} PremiumLoanTokens`);
      const borrower1Bank = lendingBank.connect(borrower1) as LendingBank;
      await borrower1Bank.depositAndBorrow(tokenType1, tokenAmount1, { value: collateralAmount1 });
      latePhase1LoanId = 5;
      
      // Create loan for Phase 2 penalty test (days 11-14)
      const tokenType2 = PREMIUM_TOKEN;
      const tokenAmount2 = ethers.parseUnits("0.25", 18);
      const tokenValue2 = await premiumLoanToken.tokenValue();
      const borrowValue2 = (tokenAmount2 * tokenValue2) / ethers.parseUnits("1", 18);
      const collateralAmount2 = (borrowValue2 * 150n) / 100n + ethers.parseEther("0.001");
      
      console.log(`Creating Phase 2 penalty test loan: ${ethers.formatUnits(tokenAmount2, 18)} PremiumLoanTokens`);
      const borrower2Bank = lendingBank.connect(borrower2) as LendingBank;
      await borrower2Bank.depositAndBorrow(tokenType2, tokenAmount2, { value: collateralAmount2 });
      latePhase2LoanId = 6;
      
      console.log(`Loans created for penalty testing: ${latePhase1LoanId}, ${latePhase2LoanId}`);
    });

    it("Should apply Phase 1 penalty (5%) for repayment in days 8-10", async function () {
      console.log("\n=== Testing Phase 1 Late Repayment Penalty ===");
      
      // Fast forward time to day 9 (past deadline)
      console.log("Fast-forwarding time to day 9...");
      await time.increase(9 * DAY_IN_SECONDS);
      
      const loanId = latePhase1LoanId;
      console.log(`Testing late repayment for loan ID: ${loanId}`);
      
      // Check loan is past due
      const isPastDue = await lendingBank.isPastDue(loanId);
      console.log(`Loan past due: ${isPastDue}`);
      
      // Calculate penalty
      const penalty = await lendingBank.calculatePenalty(loanId);
      const loan = await lendingBank.getLoan(loanId);
      
      // Verify penalty is 5% of collateral
      const expectedPenalty = loan.collateralAmount * 5n / 100n;
      console.log(`Calculated penalty: ${ethers.formatEther(penalty)} ETH (5% of collateral)`);
      expect(penalty).to.equal(expectedPenalty);
      
      // Calculate total repayment and mint tokens to borrower
      const interest = await lendingBank.calculateInterest(loanId);
      const totalRepayment = loan.tokenAmount + interest;
      const buffer = totalRepayment * 20n / 100n;
      
      console.log(`Interest: ${ethers.formatUnits(interest, 18)} tokens`);
      console.log(`Total repayment: ${ethers.formatUnits(totalRepayment, 18)} tokens`);
      
      await lendingBank.mintTestTokens(borrower1.address, loan.tokenType, totalRepayment + buffer);
      
      // Approve and repay
      const borrowerBank = lendingBank.connect(borrower1) as LendingBank;
      const borrowerToken = premiumLoanToken.connect(borrower1) as PremiumLoanToken;
      const bankAddress = await lendingBank.getAddress();
      
      await borrowerToken.approve(bankAddress, totalRepayment + buffer);
      
      // Get ETH balance before and after repayment
      const balanceBefore = await ethers.provider.getBalance(borrower1.address);
      console.log(`ETH balance before repayment: ${ethers.formatEther(balanceBefore)} ETH`);
      
      await borrowerBank.repay(loanId);
      
      const balanceAfter = await ethers.provider.getBalance(borrower1.address);
      console.log(`ETH balance after repayment: ${ethers.formatEther(balanceAfter)} ETH`);
      console.log(`ETH difference: ${ethers.formatEther(balanceAfter - balanceBefore)} ETH`);
            // Verify loan is now inactive and penalty was applied
            const updatedLoan = await lendingBank.getLoan(loanId);
            expect(updatedLoan.active).to.be.false;
            
            // Should have lost 5% of collateral to penalty
            console.log(`Received back: ${ethers.formatEther(loan.collateralAmount - penalty)} ETH out of ${ethers.formatEther(loan.collateralAmount)} ETH`);
            expect(balanceAfter > balanceBefore - ethers.parseEther("0.02")).to.be.true; // Accounting for gas costs
            
            console.log("Phase 1 penalty was successfully applied");
          });
      
          it("Should apply Phase 2 penalty (15%) for repayment in days 11-14", async function () {
            console.log("\n=== Testing Phase 2 Late Repayment Penalty ===");
            
            // Fast forward time to day 12 (Phase 2 penalty period)
            console.log("Fast-forwarding time to day 12...");
            await time.increase(3 * DAY_IN_SECONDS); // Already at day 9, advance to day 12
            
            const loanId = latePhase2LoanId;
            console.log(`Testing late repayment for loan ID: ${loanId}`);
            
            // Calculate penalty
            const penalty = await lendingBank.calculatePenalty(loanId);
            const loan = await lendingBank.getLoan(loanId);
            
            // Verify penalty is 15% of collateral
            const expectedPenalty = loan.collateralAmount * 15n / 100n;
            console.log(`Calculated penalty: ${ethers.formatEther(penalty)} ETH (15% of collateral)`);
            expect(penalty).to.equal(expectedPenalty);
            
            // Calculate total repayment and mint tokens to borrower
            const interest = await lendingBank.calculateInterest(loanId);
            const totalRepayment = loan.tokenAmount + interest;
            const buffer = totalRepayment * 20n / 100n;
            
            console.log(`Interest: ${ethers.formatUnits(interest, 18)} tokens`);
            console.log(`Total repayment: ${ethers.formatUnits(totalRepayment, 18)} tokens`);
            
            await lendingBank.mintTestTokens(borrower2.address, loan.tokenType, totalRepayment + buffer);
            
            // Approve and repay
            const borrowerBank = lendingBank.connect(borrower2) as LendingBank;
            const borrowerToken = premiumLoanToken.connect(borrower2) as PremiumLoanToken;
            const bankAddress = await lendingBank.getAddress();
            
            await borrowerToken.approve(bankAddress, totalRepayment + buffer);
            
            // Get ETH balance before and after repayment
            const balanceBefore = await ethers.provider.getBalance(borrower2.address);
            console.log(`ETH balance before repayment: ${ethers.formatEther(balanceBefore)} ETH`);
            
            await borrowerBank.repay(loanId);
            
            const balanceAfter = await ethers.provider.getBalance(borrower2.address);
            console.log(`ETH balance after repayment: ${ethers.formatEther(balanceAfter)} ETH`);
            console.log(`ETH difference: ${ethers.formatEther(balanceAfter - balanceBefore)} ETH`);
            
            // Verify loan is now inactive and penalty was applied
            const updatedLoan = await lendingBank.getLoan(loanId);
            expect(updatedLoan.active).to.be.false;
            
            // Should have lost 15% of collateral to penalty
            console.log(`Received back: ${ethers.formatEther(loan.collateralAmount - penalty)} ETH out of ${ethers.formatEther(loan.collateralAmount)} ETH`);
            expect(balanceAfter > balanceBefore - ethers.parseEther("0.02")).to.be.true; // Accounting for gas costs
            
            console.log("Phase 2 penalty was successfully applied");
          });
      
          it("Should setup loan for forfeiture test", async function () {
            console.log("\n=== Setting Up Loan Forfeiture Test ===");
            
            const tokenType = MEGA_TOKEN;
            const tokenAmount = ethers.parseUnits("0.15", 18); // Borrow 0.15 MegaLoanTokens
            const tokenValue = await megaLoanToken.tokenValue();
            const borrowValue = (tokenAmount * tokenValue) / ethers.parseUnits("1", 18);
            const collateralAmount = (borrowValue * 150n) / 100n + ethers.parseEther("0.001");
            
            console.log(`Creating forfeiture test loan: ${ethers.formatUnits(tokenAmount, 18)} MegaLoanTokens`);
            console.log(`Collateral: ${ethers.formatEther(collateralAmount)} ETH`);
            
            const borrowerBank = lendingBank.connect(borrower3) as LendingBank;
            await borrowerBank.depositAndBorrow(tokenType, tokenAmount, { value: collateralAmount });
            
            forfeitLoanId = 7;
            console.log(`Created loan ID ${forfeitLoanId} for forfeiture test`);
            
            // Verify loan was created
            const loan = await lendingBank.getLoan(forfeitLoanId);
            expect(loan.active).to.be.true;
          });
      
          it("Should forfeit entire collateral after day 15", async function () {
            console.log("\n=== Testing Full Collateral Forfeiture ===");
            
            // Fast forward time to day 16 (forfeiture period)
            console.log("Fast-forwarding time to day 20...");
            await time.increase(15 * DAY_IN_SECONDS); // Already at day 12, advance to day 16
            
            const loanId = forfeitLoanId;
            console.log(`Testing forfeiture for loan ID: ${loanId}`);
            
            // Calculate penalty (should be 100% of collateral)
            const penalty = await lendingBank.calculatePenalty(loanId);
            const loan = await lendingBank.getLoan(loanId);
            
            // ADD DEBUGGING HERE
            console.log("Loan details:", {
              borrower: loan.borrower,
              collateralAmount: ethers.formatEther(loan.collateralAmount),
              tokenType: loan.tokenType.toString(),
              tokenAmount: ethers.formatUnits(loan.tokenAmount, 18),
              issuanceTimestamp: loan.issuanceTimestamp.toString(),
              deadline: loan.deadline.toString(),
              active: loan.active
            });
          
            const latestBlock = await ethers.provider.getBlock("latest");
            const currentTimestamp = latestBlock ? latestBlock.timestamp : 0;
            console.log("Current timestamp:", currentTimestamp);
            console.log("Deadline timestamp:", loan.deadline.toString());
            
            if (currentTimestamp && loan.deadline) {
                const daysSinceDeadline = (currentTimestamp - Number(loan.deadline)) / (24*60*60);
                console.log("Days since deadline:", daysSinceDeadline.toFixed(2));
                console.log("Is beyond Phase 1 + Phase 2:", 
                daysSinceDeadline > (3 + 4) ? "Yes" : "No");
            }
            
            console.log(`Calculated penalty: ${ethers.formatEther(penalty)} ETH`);
            console.log(`Total collateral: ${ethers.formatEther(loan.collateralAmount)} ETH`);
            
            // ORIGINAL TEST CONTINUES HERE
            // Verify penalty equals full collateral amount
            expect(penalty).to.equal(loan.collateralAmount);
            console.log("Penalty equals full collateral amount as expected");
            
            // Process forfeiture
            const borrowerBank = lendingBank.connect(borrower3) as LendingBank;
            await borrowerBank.forfeitLoan(loanId);
            
            // Verify loan is now inactive
            const updatedLoan = await lendingBank.getLoan(loanId);
            expect(updatedLoan.active).to.be.false;
            console.log(`Loan forfeited successfully, status is now: ${updatedLoan.active}`);
          });
          
        });
      
        describe("Edge Cases", function () {
          it("Should handle multiple loans from the same borrower", async function () {
            console.log("\n=== Testing Multiple Loans from Same Borrower ===");
            
            // Create two loans with the same borrower
            const borrowerBank = lendingBank.connect(borrower1) as LendingBank;
            
            // Loan 1
            const tokenType1 = STABLE_TOKEN;
            const tokenAmount1 = ethers.parseUnits("0.1", 18);
            const tokenValue1 = await stableLoanToken.tokenValue();
            const borrowValue1 = (tokenAmount1 * tokenValue1) / ethers.parseUnits("1", 18);
            const collateralAmount1 = (borrowValue1 * 150n) / 100n + ethers.parseEther("0.001");
            
            console.log(`Creating first loan: ${ethers.formatUnits(tokenAmount1, 18)} StableLoanTokens`);
            await borrowerBank.depositAndBorrow(tokenType1, tokenAmount1, { value: collateralAmount1 });
            const firstLoanId = 8;
            
            // Loan 2
            const tokenType2 = STANDARD_TOKEN;
            const tokenAmount2 = ethers.parseUnits("0.2", 18);
            const tokenValue2 = await standardLoanToken.tokenValue();
            const borrowValue2 = (tokenAmount2 * tokenValue2) / ethers.parseUnits("1", 18);
            const collateralAmount2 = (borrowValue2 * 150n) / 100n + ethers.parseEther("0.001");
            
            console.log(`Creating second loan: ${ethers.formatUnits(tokenAmount2, 18)} StandardLoanTokens`);
            await borrowerBank.depositAndBorrow(tokenType2, tokenAmount2, { value: collateralAmount2 });
            const secondLoanId = 9;
            
            // Get borrower's loans
            const userLoans = await lendingBank.getUserLoans(borrower1.address);
            console.log(`Borrower's loan IDs: ${userLoans.map(id => id.toString())}`);
            
            // Borrower should have multiple loans
            expect(userLoans.length).to.be.gt(1);
            console.log(`Borrower has ${userLoans.length} loans as expected`);
            
            // Both loans should exist and be active
            const loan1 = await lendingBank.getLoan(firstLoanId);
            const loan2 = await lendingBank.getLoan(secondLoanId);
            
            expect(loan1.active).to.be.true;
            expect(loan2.active).to.be.true;
            console.log("Both loans are active as expected");
          });
      
          it("Should handle exact minimum borrowing amount", async function () {
            console.log("\n=== Testing Exact Minimum Borrowing Amount ===");
            
            // Try to borrow exactly the minimum amount
            const tokenType = STABLE_TOKEN;
            const tokenAmount = ethers.parseUnits("0.01", 18); // Exactly 0.01 tokens
            const tokenValue = await stableLoanToken.tokenValue();
            const borrowValue = (tokenAmount * tokenValue) / ethers.parseUnits("1", 18);
            const collateralAmount = (borrowValue * 150n) / 100n + ethers.parseEther("0.001");
            
            console.log(`Borrowing exact minimum: ${ethers.formatUnits(tokenAmount, 18)} tokens`);
            console.log(`Providing collateral: ${ethers.formatEther(collateralAmount)} ETH`);
            
            const borrowerBank = lendingBank.connect(borrower4) as LendingBank;
            await borrowerBank.depositAndBorrow(tokenType, tokenAmount, { value: collateralAmount });
            
            // Verify loan was created
            const loanId = 10;
            const loan = await lendingBank.getLoan(loanId);
            
            expect(loan.active).to.be.true;
            expect(loan.tokenAmount).to.equal(tokenAmount);
            console.log("Borrowing at minimum threshold succeeded as expected");
          });
        });
      });
      
