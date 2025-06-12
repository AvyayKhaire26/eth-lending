// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/ILendingBank.sol";
import "../interfaces/ILendingToken.sol";

/**
 * @title LendingBank with Circadian Rhythm Integration
 * @notice Core contract for the lending protocol with novel circadian-based interest rates
 */
contract LendingBank is ILendingBank, Ownable, ReentrancyGuard {
    // ==================== EXISTING STRUCTURES ====================
    
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

    // ==================== NEW CIRCADIAN STRUCTURES ====================
    
    struct CircadianProfile {
        int256 detectedTimezone;           // User's timezone offset in seconds
        uint256[] borrowingHours;          // Array of hours when user borrowed (0-23)
        uint256[] repaymentHours;          // Array of hours when user repaid (0-23)
        uint256 totalBorrowingSessions;    // Total number of borrowing sessions
        uint256 totalRepaymentSessions;   // Total number of repayment sessions
        uint256 circadianConsistencyScore; // Score from 0-1000 (higher = more consistent)
        uint256 lastActivityTimestamp;     // Last interaction timestamp
        bool profileInitialized;          // Whether profile has been set up
    }

    struct CircadianRateConfig {
        uint256 baseMultiplier;           // Base rate multiplier (10000 = 100%)
        uint256 nightDiscountMultiplier;  // Night hours discount (8500 = 85% = 15% discount)
        uint256 peakPremiumMultiplier;    // Peak hours premium (11000 = 110% = 10% premium)
        uint256 consistencyBonusMax;      // Maximum consistency bonus (500 = 5%)
        uint256 inconsistencyPenaltyMax;  // Maximum inconsistency penalty (2000 = 20%)
    }

    // NEW: Circadian mappings and configuration
    mapping(address => CircadianProfile) public userCircadianProfiles;
    mapping(uint256 => uint256) public hourlyRateMultipliers; // hour => multiplier
    CircadianRateConfig public circadianConfig;
    
    // Flag to enable/disable circadian features
    bool public circadianEnabled = true;

    // ==================== NEW CIRCADIAN EVENTS ====================
    
    event CircadianProfileUpdated(address indexed user, uint256 hour, bool isBorrowing);
    event CircadianRateCalculated(address indexed user, uint256 baseRate, uint256 finalRate, uint256 hour);
    event CircadianConfigUpdated(uint256 nightDiscount, uint256 peakPremium, uint256 maxBonus, uint256 maxPenalty);
    event CircadianSystemToggled(bool enabled);

    // ==================== CONSTRUCTOR ====================
    
    /**
     * @dev Constructor initializes the contract with circadian system
     */
    constructor() Ownable(msg.sender) {
        _initializeCircadianSystem();
    }

    // ==================== CIRCADIAN INITIALIZATION ====================
    
    /**
     * @dev Initialize circadian system with default configuration
     */
    function _initializeCircadianSystem() internal {
        // Set default circadian configuration
        circadianConfig = CircadianRateConfig({
            baseMultiplier: 10000,        // 100%
            nightDiscountMultiplier: 8500, // 15% discount
            peakPremiumMultiplier: 11000,  // 10% premium
            consistencyBonusMax: 500,      // 5% max bonus
            inconsistencyPenaltyMax: 2000  // 20% max penalty
        });
        
        // Initialize hourly multipliers
        _setHourlyMultipliers();
    }

    /**
     * @dev Set hourly rate multipliers based on circadian patterns
     */
    function _setHourlyMultipliers() internal {
        // Night hours (2 AM - 6 AM): Discount
        for (uint256 i = 2; i <= 6; i++) {
            hourlyRateMultipliers[i] = circadianConfig.nightDiscountMultiplier;
        }
        
        // Peak business hours (9 AM - 5 PM): Premium
        for (uint256 i = 9; i <= 17; i++) {
            hourlyRateMultipliers[i] = circadianConfig.peakPremiumMultiplier;
        }
        
        // Late night hours (10 PM - 1 AM): Moderate discount
        hourlyRateMultipliers[22] = 9000; // 10% discount
        hourlyRateMultipliers[23] = 9000;
        hourlyRateMultipliers[0] = 9000;
        hourlyRateMultipliers[1] = 9000;
        
        // Standard hours: Base rate
        for (uint256 i = 7; i <= 8; i++) {
            hourlyRateMultipliers[i] = circadianConfig.baseMultiplier;
        }
        for (uint256 i = 18; i <= 21; i++) {
            hourlyRateMultipliers[i] = circadianConfig.baseMultiplier;
        }
    }

    // ==================== EXISTING FUNCTIONS (UNMODIFIED) ====================
    
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

    // ==================== MODIFIED DEPOSIT AND BORROW (WITH CIRCADIAN) ====================
    
    /**
     * @notice Deposit ETH and borrow tokens with circadian-adjusted rates
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
        
        // NEW: Calculate circadian-adjusted interest rate
        uint256 circadianAdjustedRate = 0;
        uint256 baseRate = 0;
        uint256 currentHour = getCurrentHour();
        
        if (circadianEnabled) {
            circadianAdjustedRate = calculateCircadianInterestRate(msg.sender, tokenType, tokenAmount);
            baseRate = token.calculateInterest(tokenAmount, LOAN_DURATION);
            
            // FIXED: Emit event here instead of in view function
            emit CircadianRateCalculated(msg.sender, baseRate, circadianAdjustedRate, currentHour);
        }
        
        _loans[loanId] = Loan({
            borrower: msg.sender,
            collateralAmount: msg.value,
            tokenType: tokenType,
            tokenAmount: tokenAmount,
            issuanceTimestamp: block.timestamp,
            deadline: deadline,
            interestAccrued: circadianAdjustedRate, // Store circadian rate for later use
            active: true
        });
        
        // Add loan to user's loan list
        _userLoans[msg.sender].push(loanId);
        
        // NEW: Update user's circadian profile
        if (circadianEnabled) {
            _updateCircadianProfile(msg.sender, currentHour, true);
        }
        
        // Mint tokens to borrower
        token.mint(msg.sender, tokenAmount);
        
        emit TokenBorrowed(msg.sender, tokenType, tokenAmount, msg.value, deadline);
        
        return loanId;
    }

    // ==================== MODIFIED REPAY FUNCTION (WITH CIRCADIAN TRACKING) ====================
    
    /**
     * @notice Repay borrowed tokens and retrieve ETH collateral with circadian tracking
     * @param loanId ID of the loan to repay
     */
    function repay(uint256 loanId) external override nonReentrant {
        Loan storage loan = _loans[loanId];
        
        require(loan.active, "Loan is not active");
        require(loan.borrower == msg.sender, "Not the borrower");
        
        ILendingToken token = supportedTokens[loan.tokenType];
        
        // Calculate interest (using circadian-enhanced calculation)
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
        
        // NEW: Update circadian profile for repayment
        if (circadianEnabled) {
            _updateCircadianProfile(msg.sender, getCurrentHour(), false);
        }
        
        // Return collateral minus any penalties
        uint256 collateralToReturn = loan.collateralAmount - penaltyAmount;
        
        emit LoanRepaid(msg.sender, loan.tokenType, loan.tokenAmount, collateralToReturn, totalInterest);
        
        // Transfer collateral back to borrower
        (success, ) = payable(msg.sender).call{value: collateralToReturn}("");
        require(success, "ETH transfer failed");
    }

    // ==================== NOVEL CIRCADIAN ALGORITHM FUNCTIONS ====================
        
    /**
     * @dev Novel circadian-based interest rate calculation
     * This is the main research contribution - combines temporal patterns with user behavior
     * FIXED: Removed duplicate token variable declarations to fix shadowing error
     */
    function calculateCircadianInterestRate(
        address borrower,
        uint256 tokenType,
        uint256 borrowAmount
    ) public view returns (uint256 finalRate) {
        // FIXED: Declare token variable once at the beginning
        ILendingToken tokenContract = supportedTokens[tokenType];
        
        if (!circadianEnabled) {
            // Return standard rate if circadian is disabled
            return tokenContract.calculateInterest(borrowAmount, LOAN_DURATION);
        }
        
        // Get base interest rate for token type
        uint256 baseRate = tokenContract.calculateInterest(borrowAmount, LOAN_DURATION);
        
        // Get current hour (0-23)
        uint256 currentHour = getCurrentHour();
        
        // Apply hourly multiplier
        uint256 hourlyMultiplier = hourlyRateMultipliers[currentHour];
        if (hourlyMultiplier == 0) {
            hourlyMultiplier = circadianConfig.baseMultiplier; // Default to base if not set
        }
        
        // Calculate user's circadian behavior bonus/penalty
        uint256 behaviorMultiplier = _calculateBehaviorMultiplier(borrower, currentHour);
        
        // Novel algorithm: Combine base rate with circadian factors
        finalRate = (baseRate * hourlyMultiplier * behaviorMultiplier) / (10000 * 10000);
        
        // Note: Event emission moved to depositAndBorrow function
        
        return finalRate;
    }

    /**
     * @dev Calculate user behavior multiplier based on circadian consistency
     * Novel contribution: Personal circadian pattern analysis
     */
    function _calculateBehaviorMultiplier(address user, uint256 currentHour) 
        internal 
        view 
        returns (uint256) 
    {
        CircadianProfile memory profile = userCircadianProfiles[user];
        
        // New users get base multiplier
        if (!profile.profileInitialized || profile.totalBorrowingSessions < 3) {
            return circadianConfig.baseMultiplier;
        }
        
        // Calculate user's preferred borrowing hours
        uint256 consistencyScore = _calculateConsistencyScore(profile, currentHour);
        
        // Apply bonus/penalty based on consistency
        if (consistencyScore > 750) {
            // Highly consistent user - apply bonus
            uint256 bonus = (consistencyScore - 750) * circadianConfig.consistencyBonusMax / 250;
            return circadianConfig.baseMultiplier - bonus; // Lower rate = bonus
        } else if (consistencyScore < 250) {
            // Inconsistent user - apply penalty
            uint256 penalty = (250 - consistencyScore) * circadianConfig.inconsistencyPenaltyMax / 250;
            return circadianConfig.baseMultiplier + penalty; // Higher rate = penalty
        }
        
        return circadianConfig.baseMultiplier; // Standard rate
    }

    /**
     * @dev Novel algorithm: Calculate circadian consistency score
     * Analyzes how consistent user's borrowing patterns are with their historical behavior
     */
    function _calculateConsistencyScore(CircadianProfile memory profile, uint256 currentHour) 
        internal 
        pure 
        returns (uint256) 
    {
        if (profile.borrowingHours.length == 0) {
            return 500; // Neutral score for no history
        }
        
        // Find user's most common borrowing hours
        uint256[24] memory hourFrequency;
        for (uint256 i = 0; i < profile.borrowingHours.length; i++) {
            if (profile.borrowingHours[i] < 24) { // Safety check
                hourFrequency[profile.borrowingHours[i]]++;
            }
        }
        
        // Calculate how often they borrow in current hour or adjacent hours
        uint256 currentHourFreq = hourFrequency[currentHour];
        uint256 adjacentHourFreq = hourFrequency[(currentHour + 23) % 24] + 
                                   hourFrequency[(currentHour + 1) % 24];
        
        uint256 relevantActivity = currentHourFreq * 100 + adjacentHourFreq * 50;
        uint256 totalActivity = profile.borrowingHours.length * 100;
        
        // Score from 0-1000 based on how typical this hour is for the user
        return (relevantActivity * 1000) / totalActivity;
    }

    /**
     * @dev Update user's circadian profile with new activity
     * Core data collection for behavioral analysis
     */
    function _updateCircadianProfile(address user, uint256 hour, bool isBorrowing) internal {
        CircadianProfile storage profile = userCircadianProfiles[user];
        
        // Initialize profile if first time
        if (!profile.profileInitialized) {
            profile.profileInitialized = true;
            profile.detectedTimezone = 0; // Can be enhanced with actual timezone detection
        }
        
        // Record activity hour
        if (isBorrowing) {
            profile.borrowingHours.push(hour);
            profile.totalBorrowingSessions++;
        } else {
            profile.repaymentHours.push(hour);
            profile.totalRepaymentSessions++;
        }
        
        // Update timestamp
        profile.lastActivityTimestamp = block.timestamp;
        
        // Recalculate consistency score (simplified version)
        profile.circadianConsistencyScore = _calculateSimpleConsistencyScore(profile);
        
        emit CircadianProfileUpdated(user, hour, isBorrowing);
    }

    /**
     * @dev Simplified consistency score calculation for storage
     */
    function _calculateSimpleConsistencyScore(CircadianProfile storage profile) 
        internal 
        view 
        returns (uint256) 
    {
        if (profile.borrowingHours.length < 2) {
            return 500; // Neutral score
        }
        
        // Simple variance calculation
        uint256 sum = 0;
        for (uint256 i = 0; i < profile.borrowingHours.length; i++) {
            sum += profile.borrowingHours[i];
        }
        uint256 mean = sum / profile.borrowingHours.length;
        
        uint256 variance = 0;
        for (uint256 i = 0; i < profile.borrowingHours.length; i++) {
            uint256 diff = profile.borrowingHours[i] > mean ? 
                          profile.borrowingHours[i] - mean : 
                          mean - profile.borrowingHours[i];
            variance += diff * diff;
        }
        variance = variance / profile.borrowingHours.length;
        
        // Convert variance to consistency score (lower variance = higher consistency)
        if (variance <= 4) return 900;      // Very consistent
        else if (variance <= 16) return 700; // Moderately consistent
        else if (variance <= 36) return 500; // Average
        else if (variance <= 64) return 300; // Inconsistent
        else return 100;                      // Very inconsistent
    }

    // ==================== CIRCADIAN UTILITY FUNCTIONS ====================
    
    /**
     * @dev Get current hour in UTC (0-23)
     */
    function getCurrentHour() public view returns (uint256) {
        return (block.timestamp / 3600) % 24;
    }

    /**
     * @dev Get current day of week (0 = Sunday, 6 = Saturday)
     * For future weekend/weekday differentiation
     */
    function getCurrentDayOfWeek() public view returns (uint256) {
        return ((block.timestamp / 86400) + 4) % 7; // Adjust for epoch start day
    }

    // ==================== CIRCADIAN VIEW FUNCTIONS ====================
    
    /**
     * @dev View function to get user's circadian insights
     */
    function getUserCircadianInsights(address user) 
        external 
        view 
        returns (
            uint256 consistencyScore,
            uint256 totalSessions,
            uint256[] memory preferredHours,
            uint256 currentRateMultiplier
        ) 
    {
        CircadianProfile memory profile = userCircadianProfiles[user];
        uint256 currentHour = getCurrentHour();
        
        return (
            profile.circadianConsistencyScore,
            profile.totalBorrowingSessions,
            _getUserPreferredHours(profile),
            _calculateBehaviorMultiplier(user, currentHour)
        );
    }

    /**
     * @dev Calculate user's top 3 preferred borrowing hours
     */
    function _getUserPreferredHours(CircadianProfile memory profile) 
        internal 
        pure 
        returns (uint256[] memory) 
    {
        if (profile.borrowingHours.length == 0) {
            uint256[] memory empty = new uint256[](0);
            return empty;
        }
        
        uint256[24] memory hourCount;
        for (uint256 i = 0; i < profile.borrowingHours.length; i++) {
            if (profile.borrowingHours[i] < 24) { // Safety check
                hourCount[profile.borrowingHours[i]]++;
            }
        }
        
        // Find top 3 hours (simplified)
        uint256[] memory topHours = new uint256[](3);
        uint256 maxCount1 = 0; uint256 maxHour1 = 0;
        uint256 maxCount2 = 0; uint256 maxHour2 = 0;
        uint256 maxCount3 = 0; uint256 maxHour3 = 0;
        
        for (uint256 i = 0; i < 24; i++) {
            if (hourCount[i] > maxCount1) {
                maxCount3 = maxCount2; maxHour3 = maxHour2;
                maxCount2 = maxCount1; maxHour2 = maxHour1;
                maxCount1 = hourCount[i]; maxHour1 = i;
            } else if (hourCount[i] > maxCount2) {
                maxCount3 = maxCount2; maxHour3 = maxHour2;
                maxCount2 = hourCount[i]; maxHour2 = i;
            } else if (hourCount[i] > maxCount3) {
                maxCount3 = hourCount[i]; maxHour3 = i;
            }
        }
        
        topHours[0] = maxHour1;
        topHours[1] = maxHour2;
        topHours[2] = maxHour3;
        
        return topHours;
    }

    // ==================== CIRCADIAN ADMIN FUNCTIONS ====================
    
    /**
     * @dev Admin function to update circadian configuration
     */
    function updateCircadianConfig(
        uint256 nightDiscount,
        uint256 peakPremium,
        uint256 maxBonus,
        uint256 maxPenalty
    ) external onlyOwner {
        circadianConfig.nightDiscountMultiplier = nightDiscount;
        circadianConfig.peakPremiumMultiplier = peakPremium;
        circadianConfig.consistencyBonusMax = maxBonus;
        circadianConfig.inconsistencyPenaltyMax = maxPenalty;
        
        _setHourlyMultipliers();
        
        emit CircadianConfigUpdated(nightDiscount, peakPremium, maxBonus, maxPenalty);
    }

    /**
     * @dev Toggle circadian system on/off
     */
    function toggleCircadianSystem(bool enabled) external onlyOwner {
        circadianEnabled = enabled;
        emit CircadianSystemToggled(enabled);
    }

    /**
     * @dev Manual function to reinitialize circadian system (for upgrades)
     */
    function reinitializeCircadianSystem() external onlyOwner {
        _initializeCircadianSystem();
    }

    // ==================== EXISTING FUNCTIONS (UNMODIFIED) ====================
    
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
        
        // NEW: Apply circadian rate if it was stored during loan creation
        if (circadianEnabled && loan.interestAccrued > 0) {
            // Use the circadian-adjusted rate that was calculated during loan creation
            baseInterest = (baseInterest * loan.interestAccrued) / token.calculateInterest(loan.tokenAmount, LOAN_DURATION);
        }
        
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

    // ==================== EXISTING EVENTS ====================
    
    event ReservesInitialized(uint256 amount);
    event TokenAdded(address tokenAddress, uint256 tokenIndex);
    event TestModeSet(bool enabled);
    event TestTokensMinted(address to, uint256 tokenType, uint256 amount);
}
