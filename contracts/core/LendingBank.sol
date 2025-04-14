// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/ILendingBank.sol";
import "../interfaces/ILendingToken.sol";

/**
 * @title LendingBank
 * @notice Core contract for the lending protocol that manages deposits, loans, and repayments
 */
contract LendingBank is ILendingBank, Ownable, ReentrancyGuard {
    // Array of all supported token contracts
    ILendingToken[] public supportedTokens;
    
    // Loan counter for generating unique IDs
    uint256 private _loanCounter;
    
    // Mapping from loan ID to Loan struct
    mapping(uint256 => Loan) private _loans;
    
    // Mapping from user address to their loan IDs
    mapping(address => uint256[]) private _userLoans;
    
    // Constants
    uint256 private constant LOAN_DURATION = 7 days;
    uint256 private constant COLLATERAL_PERCENT = 150; // 150% collateralization
    uint256 private constant MINIMUM_BORROW_AMOUNT = 0.01 * 10**18; // 0.01 tokens min
    
    // Penalty constants
    uint256 private constant PHASE1_PENALTY_PERCENT = 5; // 5% of collateral
    uint256 private constant PHASE2_PENALTY_PERCENT = 15; // 15% of collateral
    uint256 private constant PHASE1_DURATION = 3 days; // Days 8-10
    uint256 private constant PHASE2_DURATION = 4 days; // Days 11-14
    
    // Early repayment incentive
    uint256 private constant EARLY_REPAYMENT_DAYS = 3;
    uint256 private constant EARLY_REPAYMENT_DISCOUNT = 20; // 20% interest reduction
    
    // Test mode flag
    bool public testMode = false;
    
    /**
     * @dev Constructor initializes the contract with the owner address
     */
    constructor() Ownable(msg.sender) {}
    
    /**
     * @notice Adds a supported token to the lending protocol
     * @param tokenAddress Address of the token contract
     */
    function addSupportedToken(address tokenAddress) external onlyOwner {
        supportedTokens.push(ILendingToken(tokenAddress));
        emit TokenAdded(tokenAddress, supportedTokens.length - 1);
    }
    
    /**
     * @notice Returns the number of supported tokens
     * @return Number of supported tokens
     */
    function getSupportedTokenCount() external view returns (uint256) {
        return supportedTokens.length;
    }
    
    /**
     * @notice Initialize token reserves for testing purposes
     * @param amount Amount of each token to mint to the bank
     */
    function initializeTokenReserves(uint256 amount) external onlyOwner {
        for (uint256 i = 0; i < supportedTokens.length; i++) {
            ILendingToken token = supportedTokens[i];
            token.mint(address(this), amount);
        }
        emit ReservesInitialized(amount);
    }
    
    /**
     * @notice Enable test mode for additional testing features
     * @param enabled True to enable test mode, false to disable
     */
    function setTestMode(bool enabled) external onlyOwner {
        testMode = enabled;
        emit TestModeSet(enabled);
    }
    
    /**
     * @notice Mint test tokens to a user for testing purposes
     * @param to Address to mint tokens to
     * @param tokenType Type of token to mint
     * @param amount Amount of tokens to mint
     */
    function mintTestTokens(address to, uint256 tokenType, uint256 amount) external {
        require(testMode, "Test mode not enabled");
        require(tokenType < supportedTokens.length, "Invalid token type");
        
        ILendingToken token = supportedTokens[tokenType];
        token.mint(to, amount);
        
        emit TestTokensMinted(to, tokenType, amount);
    }
    
    /**
     * @notice Deposit ETH and borrow tokens
     * @param tokenType Type of token to borrow (0-3 for the four token types)
     * @param tokenAmount Amount of tokens to borrow
     * @return loanId ID of the created loan
     */
    function depositAndBorrow(uint256 tokenType, uint256 tokenAmount) external payable override nonReentrant returns (uint256 loanId) {
        require(tokenType < supportedTokens.length, "Invalid token type");
        require(msg.value > 0, "Must deposit ETH");
        require(tokenAmount >= MINIMUM_BORROW_AMOUNT, "Amount below minimum threshold");
        
        ILendingToken token = supportedTokens[tokenType];
        uint256 tokenValue = token.tokenValue();
        
        // Calculate the value of tokens being borrowed
        uint256 borrowValue = (tokenAmount * tokenValue) / 10**18;
        
        // Calculate required collateral with rounding up
        uint256 requiredCollateral = (borrowValue * COLLATERAL_PERCENT + 99) / 100;
        
        require(msg.value >= requiredCollateral, "Insufficient collateral");
        
        // Create a new loan
        loanId = _loanCounter++;
        uint256 deadline = block.timestamp + LOAN_DURATION;
        
        _loans[loanId] = Loan({
            borrower: msg.sender,
            collateralAmount: msg.value,
            tokenType: tokenType,
            tokenAmount: tokenAmount,
            issuanceTimestamp: block.timestamp,
            deadline: deadline,
            interestAccrued: 0,
            active: true
        });
        
        // Add loan to user's loan list
        _userLoans[msg.sender].push(loanId);
        
        // Mint tokens to borrower
        token.mint(msg.sender, tokenAmount);
        
        emit TokenBorrowed(msg.sender, tokenType, tokenAmount, msg.value, deadline);
        
        return loanId;
    }
    
    /**
     * @notice Repay borrowed tokens and retrieve ETH collateral
     * @param loanId ID of the loan to repay
     */
    function repay(uint256 loanId) external override nonReentrant {
        Loan storage loan = _loans[loanId];
        
        require(loan.active, "Loan is not active");
        require(loan.borrower == msg.sender, "Not the borrower");
        
        ILendingToken token = supportedTokens[loan.tokenType];
        
        // Calculate interest
        uint256 interestAmount = calculateInterest(loanId);
        
        // Check if early repayment discount applies
        if (block.timestamp < loan.issuanceTimestamp + EARLY_REPAYMENT_DAYS * 1 days) {
            interestAmount = interestAmount * (100 - EARLY_REPAYMENT_DISCOUNT) / 100;
        }
        
        // Check if loan is overdue and calculate penalty
        uint256 penaltyAmount = 0;
        if (block.timestamp > loan.deadline) {
            penaltyAmount = calculatePenalty(loanId);
        }
        
        // Store interest amount for the event
        uint256 totalInterest = interestAmount;
        
        // Calculate total tokens to repay (principal + interest)
        uint256 totalRepayment = loan.tokenAmount + interestAmount;
        
        // Transfer tokens from user to contract
        address tokenAddress = address(token);
        bool success = IERC20(tokenAddress).transferFrom(msg.sender, address(this), totalRepayment);
        require(success, "Token transfer failed");
        
        // Burn the tokens from the contract
        token.burn(address(this), totalRepayment);
        
        // Mark the loan as inactive
        loan.active = false;
        loan.interestAccrued = totalInterest;
        
        // Return collateral minus any penalties
        uint256 collateralToReturn = loan.collateralAmount - penaltyAmount;
        
        emit LoanRepaid(msg.sender, loan.tokenType, loan.tokenAmount, collateralToReturn, totalInterest);
        
        // Transfer collateral back to borrower
        (success, ) = payable(msg.sender).call{value: collateralToReturn}("");
        require(success, "ETH transfer failed");
    }
    
    /**
     * @notice Check if a loan is past due
     * @param loanId ID of the loan to check
     * @return True if loan is past due
     */
    function isPastDue(uint256 loanId) external view override returns (bool) {
        Loan storage loan = _loans[loanId];
        require(loan.active, "Loan is not active");
        
        return block.timestamp > loan.deadline;
    }
    
    /**
     * @notice Calculate penalty for late repayment
     * @param loanId ID of the loan
     * @return Penalty amount
     */
    function calculatePenalty(uint256 loanId) public view override returns (uint256) {
        // First, verify the loan exists and is active
        Loan storage loan = _loans[loanId];
        require(loan.active, "Loan is not active");
        
        // If not past due, return zero penalty
        if (block.timestamp <= loan.deadline) {
            return 0;
        }
        
        // Calculate days overdue
        uint256 daysOverdue = (block.timestamp - loan.deadline);
        
        // Use direct comparison of overdue time rather than chained conditions
        // Phase 1: Days 1-3 after deadline (5% penalty)
        if (daysOverdue <= PHASE1_DURATION) {
            uint256 penalty = (loan.collateralAmount * PHASE1_PENALTY_PERCENT) / 100;
            return penalty;
        }
        
        // Phase 2: Days 4-7 after deadline (15% penalty)
        if (daysOverdue <= (PHASE1_DURATION + PHASE2_DURATION)) {
            uint256 penalty = (loan.collateralAmount * PHASE2_PENALTY_PERCENT) / 100;
            return penalty;
        }
        
        // Beyond Phase 2: Full collateral forfeiture
        // Use explicit return of the exact collateral amount
        return loan.collateralAmount;
    }

    
    /**
     * @notice Calculate total interest accrued on a loan
     * @param loanId ID of the loan
     * @return Interest amount
     */
    function calculateInterest(uint256 loanId) public view override returns (uint256) {
        Loan storage loan = _loans[loanId];
        require(loan.active, "Loan is not active");
        
        ILendingToken token = supportedTokens[loan.tokenType];
        
        // Time elapsed since loan issuance
        uint256 timeElapsed;
        
        if (block.timestamp > loan.deadline) {
            // For overdue loans, interest accrues only until deadline
            timeElapsed = loan.deadline - loan.issuanceTimestamp;
        } else {
            timeElapsed = block.timestamp - loan.issuanceTimestamp;
        }
        
        // Calculate base interest
        uint256 baseInterest = token.calculateInterest(loan.tokenAmount, timeElapsed);
        
        // If loan is overdue, apply interest rate multipliers
        if (block.timestamp > loan.deadline) {
            uint256 overdueDuration = block.timestamp - loan.deadline;
            
            if (overdueDuration <= PHASE1_DURATION) {
                // Phase 1: Double interest rate
                return baseInterest * 2;
            } else {
                // Phase 2+: Triple interest rate
                return baseInterest * 3;
            }
        }
        
        return baseInterest;
    }
    
    /**
     * @notice Get remaining time until loan is due
     * @param loanId ID of the loan
     * @return Time in seconds until deadline
     */
    function timeUntilDue(uint256 loanId) external view override returns (uint256) {
        Loan storage loan = _loans[loanId];
        require(loan.active, "Loan is not active");
        
        if (block.timestamp >= loan.deadline) {
            return 0;
        }
        
        return loan.deadline - block.timestamp;
    }
    
    /**
     * @notice Get loan details
     * @param loanId ID of the loan
     * @return Loan struct with all loan details
     */
    function getLoan(uint256 loanId) external view returns (Loan memory) {
        return _loans[loanId];
    }
    
    /**
     * @notice Get all loans for a user
     * @param user Address of the user
     * @return Array of loan IDs
     */
    function getUserLoans(address user) external view returns (uint256[] memory) {
        return _userLoans[user];
    }
    
    /**
     * @notice Process forfeiture of an overdue loan
     * @param loanId ID of the loan to forfeit
     */
    function forfeitLoan(uint256 loanId) external nonReentrant {
        Loan storage loan = _loans[loanId];
        
        require(loan.active, "Loan is not active");
        require(block.timestamp > loan.deadline + PHASE1_DURATION + PHASE2_DURATION, "Not eligible for forfeiture");
        
        // Mark loan as inactive
        loan.active = false;
        
        uint256 penaltyAmount = loan.collateralAmount;
        
        emit LoanForfeited(loan.borrower, loan.tokenType, loan.collateralAmount, penaltyAmount);
    }

    
    // Events
    event ReservesInitialized(uint256 amount);
    event TokenAdded(address tokenAddress, uint256 tokenIndex);
    event TestModeSet(bool enabled);
    event TestTokensMinted(address to, uint256 tokenType, uint256 amount);
}
