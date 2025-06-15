// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/ILendingBank.sol";
import "../interfaces/ILendingToken.sol";

/**
 * @title LendingBank with Circadian Rhythm Integration, ML Enhancement, and Dynamic Collateral
 * @notice Core contract for the lending protocol with novel circadian-based interest rates, ML chronotype detection, and risk-based collateral
 * @dev Implements real-time bio-temporal rate optimization using ML chronotype detection and dynamic risk assessment
 */
contract LendingBank is ILendingBank, Ownable, ReentrancyGuard {
    // ==================== CONSTANTS ====================
    
    uint256 private constant LOAN_DURATION = 7 days;
    uint256 private constant BASE_COLLATERAL_PERCENT = 150; // 150% base collateralization
    uint256 private constant MINIMUM_BORROW_AMOUNT = 0.01 * 10**18; // 0.01 tokens min
    
    // Penalty constants
    uint256 private constant PHASE1_PENALTY_PERCENT = 5; // 5% of collateral
    uint256 private constant PHASE2_PENALTY_PERCENT = 15; // 15% of collateral
    uint256 private constant PHASE1_DURATION = 3 days; // Days 8-10
    uint256 private constant PHASE2_DURATION = 4 days; // Days 11-14
    
    // Early repayment incentive
    uint256 private constant EARLY_REPAYMENT_DAYS = 3;
    uint256 private constant EARLY_REPAYMENT_DISCOUNT = 20; // 20% interest reduction

    // ==================== STATE VARIABLES ====================
    
    // Array of all supported token contracts
    ILendingToken[] public supportedTokens;
    
    // Loan counter for generating unique IDs
    uint256 private _loanCounter;
    
    // Mapping from loan ID to Loan struct
    mapping(uint256 => Loan) private _loans;
    
    // Mapping from user address to their loan IDs
    mapping(address => uint256[]) private _userLoans;
    
    // Test mode flag
    bool public testMode = false;

    // ==================== CIRCADIAN & ML STRUCTURES ====================
    
    struct CircadianProfile {
        int256 detectedTimezone;           // User's timezone offset in seconds
        uint256[] borrowingHours;          // Array of hours when user borrowed (0-23)
        uint256[] repaymentHours;          // Array of hours when user repaid (0-23)
        uint256 totalBorrowingSessions;    // Total number of borrowing sessions
        uint256 totalRepaymentSessions;   // Total number of repayment sessions
        uint256 circadianConsistencyScore; // Score from 0-1000 (higher = more consistent)
        uint256 lastActivityTimestamp;     // Last interaction timestamp
        bool profileInitialized;          // Whether profile has been set up
        uint256 mlDetectedChronotype;      // ML-detected chronotype (0=Early, 1=Intermediate, 2=Late)
        uint256 mlConfidenceScore;         // ML prediction confidence (0-1000)
        uint256 lastMLUpdate;              // Timestamp of last ML prediction
        uint256 riskScore;                 // User risk score (0-1000, higher = riskier)
    }

    struct CircadianRateConfig {
        uint256 baseMultiplier;           // Base rate multiplier (10000 = 100%)
        uint256 nightDiscountMultiplier;  // Night hours discount (8500 = 85% = 15% discount)
        uint256 peakPremiumMultiplier;    // Peak hours premium (11000 = 110% = 10% premium)
        uint256 consistencyBonusMax;      // Maximum consistency bonus (500 = 5%)
        uint256 inconsistencyPenaltyMax;  // Maximum inconsistency penalty (2000 = 20%)
    }

    struct MLConfig {
        string apiEndpoint;               // ML API server endpoint
        bool mlEnabled;                   // Enable/disable ML features
        uint256 minSessionsForML;         // Minimum sessions before using ML
        uint256 mlUpdateFrequency;        // How often to update ML predictions (in seconds)
        uint256 chronotypeMultiplierEarly;    // Base rate multiplier for Early chronotype (9500 = 5% bonus)
        uint256 chronotypeMultiplierIntermediate; // Base rate multiplier for Intermediate (10000 = standard)
        uint256 chronotypeMultiplierLate;      // Base rate multiplier for Late chronotype (10500 = 5% penalty)
    }

    struct DynamicCollateralConfig {
        bool enabled;                     // Enable/disable dynamic collateral
        uint256 minCollateralPercent;     // Minimum collateral requirement (135%)
        uint256 maxCollateralPercent;     // Maximum collateral requirement (200%)
        uint256 tokenRiskMultiplier0;     // Risk multiplier for token type 0 (SLT)
        uint256 tokenRiskMultiplier1;     // Risk multiplier for token type 1 (STDLT) 
        uint256 tokenRiskMultiplier2;     // Risk multiplier for token type 2 (PLT)
        uint256 tokenRiskMultiplier3;     // Risk multiplier for token type 3 (MLT)
        uint256 chronotypeCollateralEarly;    // Collateral multiplier for Early (9500 = 5% reduction)
        uint256 chronotypeCollateralIntermediate; // Collateral multiplier for Intermediate (10000 = standard)
        uint256 chronotypeCollateralLate;     // Collateral multiplier for Late (11000 = 10% increase)
        uint256 riskScoreThresholdLow;    // Low risk threshold (300)
        uint256 riskScoreThresholdHigh;   // High risk threshold (700)
    }

    // ==================== STATE MAPPINGS & CONFIG ====================
    
    mapping(address => CircadianProfile) public userCircadianProfiles;
    mapping(uint256 => uint256) public hourlyRateMultipliers; // hour => multiplier
    CircadianRateConfig public circadianConfig;
    MLConfig public mlConfig;
    DynamicCollateralConfig public collateralConfig;
    
    // System control flags
    bool public circadianEnabled = true;

    // ==================== EVENTS ====================
    
    event CircadianProfileUpdated(address indexed user, uint256 hour, bool isBorrowing);
    event CircadianRateCalculated(address indexed user, uint256 baseRate, uint256 finalRate, uint256 hour);
    event CircadianConfigUpdated(uint256 nightDiscount, uint256 peakPremium, uint256 maxBonus, uint256 maxPenalty);
    event CircadianSystemToggled(bool enabled);
    event MLChronotypeDetected(address indexed user, uint256 chronotype, uint256 confidence, uint256 timestamp);
    event MLConfigUpdated(bool enabled, uint256 minSessions, uint256 updateFrequency);
    event MLRateEnhancement(address indexed user, uint256 baseRate, uint256 mlEnhancedRate, uint256 chronotype);
    event MLPredictionRequested(address indexed user, uint256 timestamp);
    event DynamicCollateralCalculated(address indexed user, uint256 baseCollateral, uint256 dynamicCollateral, uint256 tokenType);
    event DynamicCollateralConfigUpdated(bool enabled, uint256 minPercent, uint256 maxPercent);
    event UserRiskScoreUpdated(address indexed user, uint256 oldScore, uint256 newScore);
    event ChronotypeAlignmentCalculated(address indexed user, uint256 chronotype, uint256 currentHour, uint256 alignmentScore);
    
    // Existing events from interface
    event ReservesInitialized(uint256 amount);
    event TokenAdded(address tokenAddress, uint256 tokenIndex);
    event TestModeSet(bool enabled);
    event TestTokensMinted(address to, uint256 tokenType, uint256 amount);

    // ==================== CONSTRUCTOR ====================
    
    /**
     * @dev Constructor initializes the contract with circadian system, ML integration, and dynamic collateral
     */
    constructor() Ownable(msg.sender) {
        _initializeCircadianSystem();
        _initializeMLSystem();
        _initializeDynamicCollateralSystem();
    }

    // ==================== INITIALIZATION FUNCTIONS ====================
    
    /**
     * @dev Initialize circadian system with default configuration
     */
    function _initializeCircadianSystem() internal {
        circadianConfig = CircadianRateConfig({
            baseMultiplier: 10000,        // 100%
            nightDiscountMultiplier: 8500, // 15% discount
            peakPremiumMultiplier: 11000,  // 10% premium
            consistencyBonusMax: 500,      // 5% max bonus
            inconsistencyPenaltyMax: 2000  // 20% max penalty
        });
        
        _setHourlyMultipliers();
    }

    /**
     * @dev Initialize ML system with default configuration
     */
    function _initializeMLSystem() internal {
        mlConfig = MLConfig({
            apiEndpoint: "http://localhost:5000",
            mlEnabled: true,
            minSessionsForML: 3,
            mlUpdateFrequency: 3600, // Update every hour
            chronotypeMultiplierEarly: 9500,      // 5% bonus for early chronotype (when aligned)
            chronotypeMultiplierIntermediate: 10000, // Standard rate
            chronotypeMultiplierLate: 10500       // 5% penalty for late chronotype (when misaligned)
        });
    }

    /**
     * @dev Initialize Dynamic Collateral system with default configuration
     */
    function _initializeDynamicCollateralSystem() internal {
        collateralConfig = DynamicCollateralConfig({
            enabled: true,
            minCollateralPercent: 13500,  // 135%
            maxCollateralPercent: 20000,  // 200%
            tokenRiskMultiplier0: 9500,   // SLT: 5% reduction (low risk)
            tokenRiskMultiplier1: 10000,  // STDLT: Standard
            tokenRiskMultiplier2: 11000,  // PLT: 10% increase
            tokenRiskMultiplier3: 12000,  // MLT: 20% increase (high risk)
            chronotypeCollateralEarly: 9500,      // Early: 5% reduction
            chronotypeCollateralIntermediate: 10000, // Intermediate: Standard
            chronotypeCollateralLate: 11000,      // Late: 10% increase
            riskScoreThresholdLow: 300,   // Low risk threshold
            riskScoreThresholdHigh: 700   // High risk threshold
        });
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

    // ==================== TOKEN MANAGEMENT FUNCTIONS ====================
    
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

    // ==================== DYNAMIC COLLATERAL FUNCTIONS ====================

    /**
     * @dev Calculate dynamic collateral requirement based on multiple risk factors
     * @param user User address
     * @param tokenType Type of token being borrowed
     * @param borrowValue Value of tokens being borrowed in ETH
     * @return Required collateral amount in ETH
     */
    function calculateDynamicCollateral(
        address user,
        uint256 tokenType,
        uint256 borrowValue
    ) public view returns (uint256) {
        if (!collateralConfig.enabled) {
            return (borrowValue * BASE_COLLATERAL_PERCENT) / 100;
        }

        uint256 baseCollateral = (borrowValue * BASE_COLLATERAL_PERCENT) / 100;
        uint256 tokenMultiplier = _getTokenRiskMultiplier(tokenType);
        uint256 chronotypeMultiplier = _getChronotypeCollateralMultiplier(user);
        uint256 riskMultiplier = _getUserRiskMultiplier(user);

        uint256 dynamicCollateral = (baseCollateral * tokenMultiplier * chronotypeMultiplier * riskMultiplier) / (10000 * 10000 * 10000);

        // Apply bounds
        uint256 minCollateral = (borrowValue * collateralConfig.minCollateralPercent) / 10000;
        uint256 maxCollateral = (borrowValue * collateralConfig.maxCollateralPercent) / 10000;

        if (dynamicCollateral < minCollateral) {
            dynamicCollateral = minCollateral;
        } else if (dynamicCollateral > maxCollateral) {
            dynamicCollateral = maxCollateral;
        }

        return dynamicCollateral;
    }

    /**
     * @dev Get token-specific risk multiplier
     */
    function _getTokenRiskMultiplier(uint256 tokenType) internal view returns (uint256) {
        if (tokenType == 0) return collateralConfig.tokenRiskMultiplier0; // SLT
        if (tokenType == 1) return collateralConfig.tokenRiskMultiplier1; // STDLT
        if (tokenType == 2) return collateralConfig.tokenRiskMultiplier2; // PLT
        if (tokenType == 3) return collateralConfig.tokenRiskMultiplier3; // MLT
        return 10000; // Default
    }

    /**
     * @dev Get chronotype-based collateral multiplier
     */
    function _getChronotypeCollateralMultiplier(address user) internal view returns (uint256) {
        if (!mlConfig.mlEnabled) {
            return 10000;
        }

        CircadianProfile memory profile = userCircadianProfiles[user];
        
        if (profile.totalBorrowingSessions < mlConfig.minSessionsForML) {
            return 10000;
        }

        uint256 chronotype = profile.mlDetectedChronotype;
        
        if (chronotype == 0) {
            return collateralConfig.chronotypeCollateralEarly;
        } else if (chronotype == 2) {
            return collateralConfig.chronotypeCollateralLate;
        } else {
            return collateralConfig.chronotypeCollateralIntermediate;
        }
    }

    /**
     * @dev Get user risk score multiplier
     */
    function _getUserRiskMultiplier(address user) internal view returns (uint256) {
        CircadianProfile memory profile = userCircadianProfiles[user];
        uint256 riskScore = profile.riskScore;

        if (riskScore < collateralConfig.riskScoreThresholdLow) {
            return 9500;  // Low risk: 5% collateral reduction
        } else if (riskScore > collateralConfig.riskScoreThresholdHigh) {
            return 11500; // High risk: 15% collateral increase
        } else {
            return 10000; // Medium risk: standard collateral
        }
    }

    // ==================== MAIN BORROWING FUNCTIONS ====================
    
    /**
     * @notice Deposit ETH and borrow tokens with ML-enhanced circadian rates and dynamic collateral
     * @param tokenType Type of token to borrow (0-3 for the four token types)
     * @param tokenAmount Amount of tokens to borrow
     * @return loanId ID of the created loan
     */
    function depositAndBorrow(uint256 tokenType, uint256 tokenAmount) 
        external 
        payable 
        override 
        nonReentrant 
        returns (uint256 loanId) 
    {
        require(tokenType < supportedTokens.length, "Invalid token type");
        require(msg.value > 0, "Must deposit ETH");
        require(tokenAmount >= MINIMUM_BORROW_AMOUNT, "Amount below minimum threshold");
        
        ILendingToken token = supportedTokens[tokenType];
        uint256 tokenValue = token.tokenValue();
        
        // Calculate the value of tokens being borrowed
        uint256 borrowValue = (tokenAmount * tokenValue) / 10**18;
        
        // Calculate dynamic collateral requirement
        uint256 requiredCollateral = calculateDynamicCollateral(msg.sender, tokenType, borrowValue);
        
        require(msg.value >= requiredCollateral, "Insufficient collateral");
        
        // Create a new loan
        loanId = _loanCounter++;
        uint256 deadline = block.timestamp + LOAN_DURATION;
        
        // Calculate ML-enhanced circadian rate
        uint256 circadianAdjustedRate = 0;
        uint256 baseRate = 0;
        uint256 currentHour = getCurrentHour();
        
        if (circadianEnabled) {
            circadianAdjustedRate = calculateMLEnhancedCircadianRate(msg.sender, tokenType, tokenAmount);
            baseRate = token.calculateInterest(tokenAmount, LOAN_DURATION);
            
            emit CircadianRateCalculated(msg.sender, baseRate, circadianAdjustedRate, currentHour);
        } else {
            circadianAdjustedRate = token.calculateInterest(tokenAmount, LOAN_DURATION);
        }
        
        _loans[loanId] = Loan({
            borrower: msg.sender,
            collateralAmount: msg.value,
            tokenType: tokenType,
            tokenAmount: tokenAmount,
            issuanceTimestamp: block.timestamp,
            deadline: deadline,
            interestAccrued: circadianAdjustedRate,
            active: true
        });
        
        // Add loan to user's loan list
        _userLoans[msg.sender].push(loanId);
        
        // Update user's circadian profile, ML data, and risk score
        if (circadianEnabled) {
            _updateCircadianProfile(msg.sender, currentHour, true);
            _requestMLChronotypeUpdate(msg.sender);
            _updateUserRiskScore(msg.sender);
        }
        
        // Emit dynamic collateral event
        if (collateralConfig.enabled) {
            uint256 baseCollateral = (borrowValue * BASE_COLLATERAL_PERCENT) / 100;
            emit DynamicCollateralCalculated(msg.sender, baseCollateral, requiredCollateral, tokenType);
        }
        
        // Mint tokens to borrower
        token.mint(msg.sender, tokenAmount);
        
        emit TokenBorrowed(msg.sender, tokenType, tokenAmount, msg.value, deadline);
        
        return loanId;
    }

        /**
     * @notice Alternative borrowing function with explicit ML prediction
     * @param tokenType Type of token to borrow
     * @param tokenAmount Amount of tokens to borrow
     * @param userActivityPattern User's recent activity pattern for ML prediction
     * @return loanId ID of the created loan
     */
    function borrowWithMLPrediction(
        uint256 tokenType, 
        uint256 tokenAmount,
        uint256[] calldata userActivityPattern
    ) external payable nonReentrant returns (uint256 loanId) {
        require(tokenType < supportedTokens.length, "Invalid token type");
        require(msg.value > 0, "Must deposit ETH");
        require(tokenAmount >= MINIMUM_BORROW_AMOUNT, "Amount below minimum threshold");
        require(userActivityPattern.length >= 24, "Activity pattern too short");
        
        ILendingToken token = supportedTokens[tokenType];
        uint256 tokenValue = token.tokenValue();
        
        // Calculate the value of tokens being borrowed
        uint256 borrowValue = (tokenAmount * tokenValue) / 10**18;
        
        // Calculate dynamic collateral requirement
        uint256 requiredCollateral = calculateDynamicCollateral(msg.sender, tokenType, borrowValue);
        
        require(msg.value >= requiredCollateral, "Insufficient collateral");
        
        // FIRST: Process ML prediction to update chronotype
        if (mlConfig.mlEnabled && userActivityPattern.length > 0) {
            _processMLPrediction(msg.sender, userActivityPattern);
        }
        
        // Create a new loan
        loanId = _loanCounter++;
        uint256 deadline = block.timestamp + LOAN_DURATION;
        
        // Calculate ML-enhanced circadian rate
        uint256 circadianAdjustedRate = 0;
        uint256 baseRate = 0;
        uint256 currentHour = getCurrentHour();
        
        if (circadianEnabled) {
            circadianAdjustedRate = calculateMLEnhancedCircadianRate(msg.sender, tokenType, tokenAmount);
            baseRate = token.calculateInterest(tokenAmount, LOAN_DURATION);
            
            emit CircadianRateCalculated(msg.sender, baseRate, circadianAdjustedRate, currentHour);
        } else {
            circadianAdjustedRate = token.calculateInterest(tokenAmount, LOAN_DURATION);
        }
        
        _loans[loanId] = Loan({
            borrower: msg.sender,
            collateralAmount: msg.value,
            tokenType: tokenType,
            tokenAmount: tokenAmount,
            issuanceTimestamp: block.timestamp,
            deadline: deadline,
            interestAccrued: circadianAdjustedRate,
            active: true
        });
        
        // Add loan to user's loan list
        _userLoans[msg.sender].push(loanId);
        
        // Update user's circadian profile, ML data, and risk score
        if (circadianEnabled) {
            _updateCircadianProfile(msg.sender, currentHour, true);
            _requestMLChronotypeUpdate(msg.sender);
            _updateUserRiskScore(msg.sender);
        }
        
        // Emit dynamic collateral event
        if (collateralConfig.enabled) {
            uint256 baseCollateral = (borrowValue * BASE_COLLATERAL_PERCENT) / 100;
            emit DynamicCollateralCalculated(msg.sender, baseCollateral, requiredCollateral, tokenType);
        }
        
        // Mint tokens to borrower
        token.mint(msg.sender, tokenAmount);
        
        emit TokenBorrowed(msg.sender, tokenType, tokenAmount, msg.value, deadline);
        
        return loanId;
    }



    /**
     * @notice Preview borrowing terms before actual borrowing
     * @param user User address
     * @param tokenType Type of token to borrow
     * @param tokenAmount Amount of tokens to borrow
     * @return requiredCollateral Required collateral in ETH
     * @return interestRate Estimated interest rate
     * @return riskScore User's current risk score
     */
    function previewBorrowingTerms(
        address user,
        uint256 tokenType,
        uint256 tokenAmount
    ) external view returns (
        uint256 requiredCollateral,
        uint256 interestRate,
        uint256 riskScore
    ) {
        require(tokenType < supportedTokens.length, "Invalid token type");
        
        ILendingToken token = supportedTokens[tokenType];
        uint256 tokenValue = token.tokenValue();
        uint256 borrowValue = (tokenAmount * tokenValue) / 10**18;
        
        requiredCollateral = calculateDynamicCollateral(user, tokenType, borrowValue);
        interestRate = calculateMLEnhancedCircadianRate(user, tokenType, tokenAmount);
        riskScore = userCircadianProfiles[user].riskScore;
        
        return (requiredCollateral, interestRate, riskScore);
    }

    // ==================== REPAYMENT FUNCTION ====================
    
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
        
        uint256 totalInterest = interestAmount;
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
        
        // Update user profiles
        if (circadianEnabled) {
            _updateCircadianProfile(msg.sender, getCurrentHour(), false);
            _requestMLChronotypeUpdate(msg.sender);
            _updateUserRiskScore(msg.sender);
        }
        
        // Return collateral minus any penalties
        uint256 collateralToReturn = loan.collateralAmount - penaltyAmount;
        
        emit LoanRepaid(msg.sender, loan.tokenType, loan.tokenAmount, collateralToReturn, totalInterest);
        
        // Transfer collateral back to borrower
        (success, ) = payable(msg.sender).call{value: collateralToReturn}("");
        require(success, "ETH transfer failed");
    }

    // ==================== ML-ENHANCED RATE CALCULATION ====================
    
    /**
     * @dev ML-enhanced circadian interest rate calculation with dynamic chronotype alignment
     */
    function calculateMLEnhancedCircadianRate(
        address borrower,
        uint256 tokenType,
        uint256 borrowAmount
    ) public view returns (uint256 finalRate) {
        ILendingToken tokenContract = supportedTokens[tokenType];
        
        if (!circadianEnabled) {
            return tokenContract.calculateInterest(borrowAmount, LOAN_DURATION);
        }
        
        uint256 baseRate = tokenContract.calculateInterest(borrowAmount, LOAN_DURATION);
        uint256 currentHour = getCurrentHour();
        
        // Layer 1: Hourly multiplier (time-based)
        uint256 hourlyMultiplier = hourlyRateMultipliers[currentHour];
        if (hourlyMultiplier == 0) {
            hourlyMultiplier = circadianConfig.baseMultiplier;
        }
        
        // Layer 2: Behavior multiplier (consistency-based)
        uint256 behaviorMultiplier = _calculateBehaviorMultiplier(borrower, currentHour);
        
        // Layer 3: ML chronotype multiplier (bio-temporal alignment)
        uint256 mlMultiplier = _calculateMLChronotypeMultiplier(borrower, currentHour);
        
        // Four-layer calculation: base * hourly * behavior * ML
        finalRate = (baseRate * hourlyMultiplier * behaviorMultiplier * mlMultiplier) / (10000 * 10000 * 10000);
        
        return finalRate;
    }

    /**
     * @dev Calculate ML-based chronotype multiplier with dynamic time alignment
     * @param user User address
     * @param currentHour Current hour (0-23)
     * @return Multiplier based on chronotype-time alignment
     */
    function _calculateMLChronotypeMultiplier(address user, uint256 currentHour) internal view returns (uint256) {
        if (!mlConfig.mlEnabled) {
            return 10000; // No ML adjustment
        }
        
        CircadianProfile memory profile = userCircadianProfiles[user];
        
        // Require minimum sessions for ML prediction
        if (profile.totalBorrowingSessions < mlConfig.minSessionsForML) {
            return 10000; // Standard rate for new users
        }
        
        // Check if ML prediction is recent enough
        if (block.timestamp > profile.lastMLUpdate + mlConfig.mlUpdateFrequency) {
            return 10000; // Use standard rate if prediction is stale
        }
        
        uint256 chronotype = profile.mlDetectedChronotype;
        uint256 confidence = profile.mlConfidenceScore;
        
        // Calculate time-alignment score for current chronotype
        uint256 alignmentScore = _calculateChronotypeAlignment(chronotype, currentHour);
        
        // Get base chronotype multiplier
        uint256 baseMultiplier;
        if (chronotype == 0) {
            baseMultiplier = mlConfig.chronotypeMultiplierEarly;
        } else if (chronotype == 2) {
            baseMultiplier = mlConfig.chronotypeMultiplierLate;
        } else {
            baseMultiplier = mlConfig.chronotypeMultiplierIntermediate;
        }
        
        // Apply time-alignment modification to base multiplier
        uint256 alignmentAdjustedMultiplier = (baseMultiplier * alignmentScore) / 1000;
        
        // Apply confidence weighting
        uint256 finalMultiplier = (confidence * alignmentAdjustedMultiplier + (1000 - confidence) * 10000) / 1000;
        
        // REMOVED: emit ChronotypeAlignmentCalculated(user, chronotype, currentHour, alignmentScore);
        
        return finalMultiplier;
    }


    /**
     * @dev Calculate how well current time aligns with user's chronotype
     * @param chronotype User's detected chronotype (0=Early, 1=Intermediate, 2=Late)
     * @param currentHour Current hour (0-23)
     * @return Alignment score (800-1200, where 1000=neutral, >1000=bonus, <1000=penalty)
     */
    function _calculateChronotypeAlignment(uint256 chronotype, uint256 currentHour) internal pure returns (uint256) {
        if (chronotype == 0) { // Early chronotype
            if (currentHour >= 6 && currentHour <= 11) {
                return 1200; // 20% bonus for optimal hours (6 AM - 11 AM)
            } else if (currentHour >= 12 && currentHour <= 17) {
                return 1000; // Neutral for afternoon
            } else if (currentHour >= 18 && currentHour <= 21) {
                return 900;  // 10% penalty for evening
            } else {
                return 800;  // 20% penalty for night/very early morning
            }
        } else if (chronotype == 2) { // Late chronotype
            if (currentHour >= 20 || currentHour <= 2) {
                return 1200; // 20% bonus for optimal hours (8 PM - 2 AM)
            } else if (currentHour >= 14 && currentHour <= 19) {
                return 1000; // Neutral for afternoon/evening
            } else if (currentHour >= 9 && currentHour <= 13) {
                return 900;  // 10% penalty for late morning
            } else {
                return 800;  // 20% penalty for early morning
            }
        } else { // Intermediate chronotype (1)
            if (currentHour >= 9 && currentHour <= 17) {
                return 1100; // 10% bonus for standard business hours
            } else if (currentHour >= 6 && currentHour <= 8) {
                return 1000; // Neutral for early morning
            } else if (currentHour >= 18 && currentHour <= 22) {
                return 1000; // Neutral for evening
            } else {
                return 900;  // 10% penalty for night hours
            }
        }
    }

    // ==================== BEHAVIOR & RISK CALCULATION ====================
    
    /**
     * @dev Calculate user behavior multiplier based on circadian consistency
     */
    function _calculateBehaviorMultiplier(address user, uint256 currentHour) 
        internal 
        view 
        returns (uint256) 
    {
        CircadianProfile memory profile = userCircadianProfiles[user];
        
        if (!profile.profileInitialized || profile.totalBorrowingSessions < 3) {
            return circadianConfig.baseMultiplier;
        }
        
        uint256 consistencyScore = _calculateConsistencyScore(profile, currentHour);
        
        if (consistencyScore > 750) {
            uint256 bonus = (consistencyScore - 750) * circadianConfig.consistencyBonusMax / 250;
            return circadianConfig.baseMultiplier - bonus;
        } else if (consistencyScore < 250) {
            uint256 penalty = (250 - consistencyScore) * circadianConfig.inconsistencyPenaltyMax / 250;
            return circadianConfig.baseMultiplier + penalty;
        }
        
        return circadianConfig.baseMultiplier;
    }

    /**
     * @dev Calculate circadian consistency score
     */
    function _calculateConsistencyScore(CircadianProfile memory profile, uint256 currentHour) 
        internal 
        pure 
        returns (uint256) 
    {
        if (profile.borrowingHours.length == 0) {
            return 500; // Neutral score
        }
        
        uint256[24] memory hourFrequency;
        for (uint256 i = 0; i < profile.borrowingHours.length; i++) {
            if (profile.borrowingHours[i] < 24) {
                hourFrequency[profile.borrowingHours[i]]++;
            }
        }
        
        uint256 currentHourFreq = hourFrequency[currentHour];
        uint256 adjacentHourFreq = hourFrequency[(currentHour + 23) % 24] + 
                                   hourFrequency[(currentHour + 1) % 24];
        
        uint256 relevantActivity = currentHourFreq * 100 + adjacentHourFreq * 50;
        uint256 totalActivity = profile.borrowingHours.length * 100;
        
        return (relevantActivity * 1000) / totalActivity;
    }

    /**
     * @dev Update user risk score based on behavior patterns
     */
    function _updateUserRiskScore(address user) internal {
        CircadianProfile storage profile = userCircadianProfiles[user];
        
        uint256 oldScore = profile.riskScore;
        uint256 newScore = _calculateUserRiskScore(user);
        
        profile.riskScore = newScore;
        
        emit UserRiskScoreUpdated(user, oldScore, newScore);
    }

    /**
     * @dev Calculate user risk score based on multiple factors
     */
    function _calculateUserRiskScore(address user) internal view returns (uint256) {
        CircadianProfile memory profile = userCircadianProfiles[user];
        
        if (profile.totalBorrowingSessions == 0) {
            return 500; // Neutral score for new users
        }

        uint256 riskScore = 500; // Base score

        // Factor 1: Consistency score (lower consistency = higher risk)
        if (profile.circadianConsistencyScore < 300) {
            riskScore += 200; // Add risk for inconsistency
        } else if (profile.circadianConsistencyScore > 700) {
            riskScore -= 100; // Reduce risk for consistency
        }

        // Factor 2: ML confidence (lower confidence = higher risk)
        if (profile.mlConfidenceScore < 600) {
            riskScore += 100; // Add risk for low ML confidence
        } else if (profile.mlConfidenceScore > 800) {
            riskScore -= 50; // Reduce risk for high ML confidence
        }

        // Factor 3: Chronotype-based risk adjustment
        if (profile.mlDetectedChronotype == 2) { // Late chronotype
            riskScore += 100; // Research shows higher financial risk
        } else if (profile.mlDetectedChronotype == 0) { // Early chronotype
            riskScore -= 50; // Research shows lower financial risk
        }

        // Factor 4: Activity recency (stale users = higher risk)
        if (block.timestamp > profile.lastActivityTimestamp + 30 days) {
            riskScore += 150; // Penalize inactive users
        }

        // Bounds: 0-1000
        if (riskScore > 1000) riskScore = 1000;
        
        return riskScore;
    }

    // ==================== PROFILE MANAGEMENT ====================
    
    /**
     * @dev Update user's circadian profile with new activity
     */
    function _updateCircadianProfile(address user, uint256 hour, bool isBorrowing) internal {
        CircadianProfile storage profile = userCircadianProfiles[user];
        
        if (!profile.profileInitialized) {
            profile.profileInitialized = true;
            profile.detectedTimezone = 0;
            profile.mlDetectedChronotype = 1; // Default to intermediate
            profile.mlConfidenceScore = 500;  // Neutral confidence
            profile.riskScore = 500;          // Neutral risk
        }
        
        if (isBorrowing) {
            profile.borrowingHours.push(hour);
            profile.totalBorrowingSessions++;
        } else {
            profile.repaymentHours.push(hour);
            profile.totalRepaymentSessions++;
        }
        
        profile.lastActivityTimestamp = block.timestamp;
        profile.circadianConsistencyScore = _calculateSimpleConsistencyScore(profile);
        
        emit CircadianProfileUpdated(user, hour, isBorrowing);
    }

    /**
     * @dev Simplified consistency score calculation for storage efficiency
     */
    function _calculateSimpleConsistencyScore(CircadianProfile storage profile) 
        internal 
        view 
        returns (uint256) 
    {
        if (profile.borrowingHours.length < 2) {
            return 500;
        }
        
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
        
        // Convert variance to consistency score
        if (variance <= 4) return 900;      // Very consistent
        else if (variance <= 16) return 700; // Somewhat consistent
        else if (variance <= 36) return 500; // Average
        else if (variance <= 64) return 300; // Somewhat inconsistent
        else return 100;                     // Very inconsistent
    }

    // ==================== ML INTEGRATION FUNCTIONS ====================
    
    /**
     * @dev Request ML chronotype update for user
     */
    function _requestMLChronotypeUpdate(address user) internal {
        CircadianProfile storage profile = userCircadianProfiles[user];
        
        if (profile.totalBorrowingSessions >= mlConfig.minSessionsForML &&
            block.timestamp > profile.lastMLUpdate + mlConfig.mlUpdateFrequency) {
            
            emit MLPredictionRequested(user, block.timestamp);
            _simulateMLPrediction(user);
        }
    }

    /**
     * @dev Simulate ML prediction (placeholder for real API integration)
     */
    function _simulateMLPrediction(address user) internal {
        CircadianProfile storage profile = userCircadianProfiles[user];
        
        if (profile.borrowingHours.length > 0) {
            uint256 avgHour = 0;
            for (uint256 i = 0; i < profile.borrowingHours.length; i++) {
                avgHour += profile.borrowingHours[i];
            }
            avgHour = avgHour / profile.borrowingHours.length;
            
            uint256 chronotype;
            uint256 confidence = 750; // Base confidence
            
            // Calculate variance for confidence adjustment
            uint256 sum = 0;
            for (uint256 i = 0; i < profile.borrowingHours.length; i++) {
                uint256 diff = profile.borrowingHours[i] > avgHour ? 
                              profile.borrowingHours[i] - avgHour : 
                              avgHour - profile.borrowingHours[i];
                sum += diff;
            }
            uint256 avgDeviation = sum / profile.borrowingHours.length;
            
            // Adjust confidence based on consistency
            if (avgDeviation <= 2) {
                confidence = 900; // Very consistent = high confidence
            } else if (avgDeviation <= 4) {
                confidence = 800; // Somewhat consistent
            } else {
                confidence = 600; // Inconsistent = lower confidence
            }
            
            // Classify chronotype based on average hour
            if (avgHour <= 10) {
                chronotype = 0; // Early
            } else if (avgHour >= 20) {
                chronotype = 2; // Late
            } else {
                chronotype = 1; // Intermediate
            }
            
            profile.mlDetectedChronotype = chronotype;
            profile.mlConfidenceScore = confidence;
            profile.lastMLUpdate = block.timestamp;
            
            emit MLChronotypeDetected(user, chronotype, confidence, block.timestamp);
        }
    }

    /**
     * @dev Process ML prediction from external API call
     */
    function _processMLPrediction(address user, uint256[] calldata activityPattern) internal {
        CircadianProfile storage profile = userCircadianProfiles[user];
        
        if (activityPattern.length >= 24) {
            // Find peak activity hour
            uint256 peakHour = 0;
            uint256 maxActivity = 0;
            
            for (uint256 i = 0; i < 24 && i < activityPattern.length; i++) {
                if (activityPattern[i] > maxActivity) {
                    maxActivity = activityPattern[i];
                    peakHour = i;
                }
            }
            
            // Calculate activity distribution for confidence
            uint256 totalActivity = 0;
            for (uint256 i = 0; i < 24 && i < activityPattern.length; i++) {
                totalActivity += activityPattern[i];
            }
            
            uint256 peakRatio = (maxActivity * 1000) / totalActivity;
            uint256 confidence = peakRatio > 100 ? 800 : 600; // Higher peak = higher confidence
            
            // Classify based on peak hour
            uint256 chronotype;
            if (peakHour <= 10) {
                chronotype = 0; // Early
            } else if (peakHour >= 20) {
                chronotype = 2; // Late
            } else {
                chronotype = 1; // Intermediate
            }
            
            profile.mlDetectedChronotype = chronotype;
            profile.mlConfidenceScore = confidence;
            profile.lastMLUpdate = block.timestamp;
            
            emit MLChronotypeDetected(user, chronotype, confidence, block.timestamp);
        }
    }

    // ==================== LEGACY CIRCADIAN RATE CALCULATION ====================
    
    /**
     * @dev Original circadian-based interest rate calculation (for compatibility)
     */
    function calculateCircadianInterestRate(
        address borrower,
        uint256 tokenType,
        uint256 borrowAmount
    ) public view returns (uint256 finalRate) {
        ILendingToken tokenContract = supportedTokens[tokenType];
        
        if (!circadianEnabled) {
            return tokenContract.calculateInterest(borrowAmount, LOAN_DURATION);
        }
        
        uint256 baseRate = tokenContract.calculateInterest(borrowAmount, LOAN_DURATION);
        uint256 currentHour = getCurrentHour();
        
        uint256 hourlyMultiplier = hourlyRateMultipliers[currentHour];
        if (hourlyMultiplier == 0) {
            hourlyMultiplier = circadianConfig.baseMultiplier;
        }
        
        uint256 behaviorMultiplier = _calculateBehaviorMultiplier(borrower, currentHour);
        
        finalRate = (baseRate * hourlyMultiplier * behaviorMultiplier) / (10000 * 10000);
        
        return finalRate;
    }

    // ==================== UTILITY FUNCTIONS ====================
    
    /**
     * @dev Get current hour in UTC (0-23)
     */
    function getCurrentHour() public view returns (uint256) {
        return (block.timestamp / 3600) % 24;
    }

    /**
     * @dev Get current day of week (0 = Sunday, 6 = Saturday)
     */
    function getCurrentDayOfWeek() public view returns (uint256) {
        return ((block.timestamp / 86400) + 4) % 7;
    }

    // ==================== VIEW FUNCTIONS ====================
    
    /**
     * @dev Get comprehensive user ML-enhanced circadian insights
     */
    function getUserMLCircadianInsights(address user) 
        external 
        view 
        returns (
            uint256 consistencyScore,
            uint256 totalSessions,
            uint256[] memory preferredHours,
            uint256 currentRateMultiplier,
            uint256 mlChronotype,
            uint256 mlConfidence,
            uint256 lastMLUpdate,
            uint256 riskScore,
            uint256 currentAlignment
        ) 
    {
        CircadianProfile memory profile = userCircadianProfiles[user];
        uint256 currentHour = getCurrentHour();
        
        return (
            profile.circadianConsistencyScore,
            profile.totalBorrowingSessions,
            _getUserPreferredHours(profile),
            _calculateBehaviorMultiplier(user, currentHour),
            profile.mlDetectedChronotype,
            profile.mlConfidenceScore,
            profile.lastMLUpdate,
            profile.riskScore,
            _calculateChronotypeAlignment(profile.mlDetectedChronotype, currentHour)
        );
    }

    /**
     * @dev Compare rate calculations: traditional vs ML-enhanced
     */
    function compareRateCalculations(address user, uint256 tokenType, uint256 amount)
        external
        view
        returns (
            uint256 traditionalRate,
            uint256 mlEnhancedRate,
            uint256 savings,
            bool mlBeneficial
        )
    {
        traditionalRate = calculateCircadianInterestRate(user, tokenType, amount);
        mlEnhancedRate = calculateMLEnhancedCircadianRate(user, tokenType, amount);
        
        if (mlEnhancedRate < traditionalRate) {
            savings = traditionalRate - mlEnhancedRate;
            mlBeneficial = true;
        } else {
            savings = mlEnhancedRate - traditionalRate;
            mlBeneficial = false;
        }
        
        return (traditionalRate, mlEnhancedRate, savings, mlBeneficial);
    }

    /**
     * @dev Get optimal borrowing times for user based on ML chronotype
     */
    function getOptimalBorrowingTimes(address user) 
        external 
        view 
        returns (uint256[] memory optimalHours, uint256[] memory rates) 
    {
        CircadianProfile memory profile = userCircadianProfiles[user];
        
        uint256[] memory optimalTimes = new uint256[](5);
        uint256[] memory hourRates = new uint256[](5);
        
        uint256 chronotype = profile.mlDetectedChronotype;
        
        if (chronotype == 0) { // Early chronotype
            optimalTimes[0] = 6; optimalTimes[1] = 7; optimalTimes[2] = 8; optimalTimes[3] = 9; optimalTimes[4] = 10;
        } else if (chronotype == 2) { // Late chronotype
            optimalTimes[0] = 20; optimalTimes[1] = 21; optimalTimes[2] = 22; optimalTimes[3] = 23; optimalTimes[4] = 0;
        } else { // Intermediate
            optimalTimes[0] = 9; optimalTimes[1] = 10; optimalTimes[2] = 14; optimalTimes[3] = 15; optimalTimes[4] = 16;
        }
        
        // Calculate rates for each optimal hour (using Standard token as example)
        for (uint256 i = 0; i < 5; i++) {
            uint256 hourMultiplier = hourlyRateMultipliers[optimalTimes[i]];
            if (hourMultiplier == 0) hourMultiplier = 10000;
            
            uint256 mlMultiplier = _calculateMLChronotypeMultiplier(user, optimalTimes[i]);
            hourRates[i] = (8000 * hourMultiplier * mlMultiplier) / (10000 * 10000); // 8% base for Standard token
        }
        
        return (optimalTimes, hourRates);
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
            if (profile.borrowingHours[i] < 24) {
                hourCount[profile.borrowingHours[i]]++;
            }
        }
        
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

    // ==================== ADMIN FUNCTIONS ====================
    
    /**
     * @dev Update ML configuration
     */
    function updateMLConfig(
        bool enabled,
        uint256 minSessions,
        uint256 updateFrequency,
        uint256 earlyMultiplier,
        uint256 intermediateMultiplier,
        uint256 lateMultiplier
    ) external onlyOwner {
        mlConfig.mlEnabled = enabled;
        mlConfig.minSessionsForML = minSessions;
        mlConfig.mlUpdateFrequency = updateFrequency;
        mlConfig.chronotypeMultiplierEarly = earlyMultiplier;
        mlConfig.chronotypeMultiplierIntermediate = intermediateMultiplier;
        mlConfig.chronotypeMultiplierLate = lateMultiplier;
        
        emit MLConfigUpdated(enabled, minSessions, updateFrequency);
    }

    /**
     * @dev Update Dynamic Collateral configuration
     */
    function updateDynamicCollateralConfig(
        bool enabled,
        uint256 minPercent,
        uint256 maxPercent,
        uint256 token0Multiplier,
        uint256 token1Multiplier,
        uint256 token2Multiplier,
        uint256 token3Multiplier,
        uint256 earlyCollateral,
        uint256 intermediateCollateral,
        uint256 lateCollateral
    ) external onlyOwner {
        collateralConfig.enabled = enabled;
        collateralConfig.minCollateralPercent = minPercent;
        collateralConfig.maxCollateralPercent = maxPercent;
        collateralConfig.tokenRiskMultiplier0 = token0Multiplier;
        collateralConfig.tokenRiskMultiplier1 = token1Multiplier;
        collateralConfig.tokenRiskMultiplier2 = token2Multiplier;
        collateralConfig.tokenRiskMultiplier3 = token3Multiplier;
        collateralConfig.chronotypeCollateralEarly = earlyCollateral;
        collateralConfig.chronotypeCollateralIntermediate = intermediateCollateral;
        collateralConfig.chronotypeCollateralLate = lateCollateral;
        
        emit DynamicCollateralConfigUpdated(enabled, minPercent, maxPercent);
    }

    /**
     * @dev Manually update user's ML chronotype
     */
    function updateUserMLChronotype(
        address user,
        uint256 chronotype,
        uint256 confidence
    ) external onlyOwner {
        require(chronotype <= 2, "Invalid chronotype");
        require(confidence <= 1000, "Invalid confidence");
        
        CircadianProfile storage profile = userCircadianProfiles[user];
        profile.mlDetectedChronotype = chronotype;
        profile.mlConfidenceScore = confidence;
        profile.lastMLUpdate = block.timestamp;
        
        emit MLChronotypeDetected(user, chronotype, confidence, block.timestamp);
    }

    /**
     * @dev Update circadian configuration
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
     * @dev Set ML API endpoint
     */
    function setMLAPIEndpoint(string calldata endpoint) external onlyOwner {
        mlConfig.apiEndpoint = endpoint;
    }

    // ==================== EXISTING INTERFACE FUNCTIONS ====================
    
    /**
     * @notice Check if a loan is past due
     */
    function isPastDue(uint256 loanId) external view override returns (bool) {
        Loan storage loan = _loans[loanId];
        require(loan.active, "Loan is not active");
        return block.timestamp > loan.deadline;
    }
    
    /**
     * @notice Calculate penalty for late repayment
     */
    function calculatePenalty(uint256 loanId) public view override returns (uint256) {
        Loan storage loan = _loans[loanId];
        require(loan.active, "Loan is not active");
        
        if (block.timestamp <= loan.deadline) {
            return 0;
        }
        
        uint256 daysOverdue = (block.timestamp - loan.deadline);
        
        if (daysOverdue <= PHASE1_DURATION) {
            return (loan.collateralAmount * PHASE1_PENALTY_PERCENT) / 100;
        }
        
        if (daysOverdue <= (PHASE1_DURATION + PHASE2_DURATION)) {
            return (loan.collateralAmount * PHASE2_PENALTY_PERCENT) / 100;
        }
        
        return loan.collateralAmount;
    }

    /**
     * @notice Calculate total interest accrued on a loan
     */
    function calculateInterest(uint256 loanId) public view override returns (uint256) {
        Loan storage loan = _loans[loanId];
        require(loan.active, "Loan is not active");
        
        ILendingToken token = supportedTokens[loan.tokenType];
        
        uint256 timeElapsed;
        if (block.timestamp > loan.deadline) {
            timeElapsed = loan.deadline - loan.issuanceTimestamp;
        } else {
            timeElapsed = block.timestamp - loan.issuanceTimestamp;
        }
        
        uint256 baseInterest = token.calculateInterest(loan.tokenAmount, timeElapsed);
        
        if (circadianEnabled && loan.interestAccrued > 0) {
            baseInterest = (baseInterest * loan.interestAccrued) / token.calculateInterest(loan.tokenAmount, LOAN_DURATION);
        }
        
        if (block.timestamp > loan.deadline) {
            uint256 overdueDuration = block.timestamp - loan.deadline;
            
            if (overdueDuration <= PHASE1_DURATION) {
                return baseInterest * 2;
            } else {
                return baseInterest * 3;
            }
        }
        
        return baseInterest;
    }
    
    /**
     * @notice Get remaining time until loan is due
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
     */
    function getLoan(uint256 loanId) external view returns (Loan memory) {
        return _loans[loanId];
    }
    
    /**
     * @notice Get all loans for a user
     */
    function getUserLoans(address user) external view returns (uint256[] memory) {
        return _userLoans[user];
    }
    
    /**
     * @notice Process forfeiture of an overdue loan
     */
    function forfeitLoan(uint256 loanId) external nonReentrant {
        Loan storage loan = _loans[loanId];
        
        require(loan.active, "Loan is not active");
        require(block.timestamp > loan.deadline + PHASE1_DURATION + PHASE2_DURATION, "Not eligible for forfeiture");
        
        loan.active = false;
        
        uint256 penaltyAmount = loan.collateralAmount;
        
        emit LoanForfeited(loan.borrower, loan.tokenType, loan.collateralAmount, penaltyAmount);
    }
}
