// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title Lending Bank Interface
 * @notice Interface for the main bank contract that handles deposits, loans and repayments
 */
interface ILendingBank {
    /**
     * @notice Struct to track loan information
     */
    struct Loan {
        address borrower;
        uint256 collateralAmount;
        uint256 tokenType;
        uint256 tokenAmount;
        uint256 issuanceTimestamp;
        uint256 deadline;
        uint256 interestAccrued;
        bool active;
    }
    
    /**
     * @notice Emitted when a user deposits ETH and borrows a token
     */
    event TokenBorrowed(address indexed borrower, uint256 indexed tokenType, uint256 tokenAmount, uint256 collateralAmount, uint256 deadline);
    
    /**
     * @notice Emitted when a user repays tokens and retrieves collateral
     */
    event LoanRepaid(address indexed borrower, uint256 indexed tokenType, uint256 tokenAmount, uint256 collateralAmount, uint256 interest);
    
    /**
     * @notice Emitted when a loan is forfeited due to missed deadline
     */
    event LoanForfeited(address indexed borrower, uint256 indexed tokenType, uint256 collateralAmount, uint256 penaltyAmount);
    
    /**
     * @notice Deposit ETH and borrow tokens
     * @param tokenType Type of token to borrow (0-3 for the four token types)
     * @param tokenAmount Amount of tokens to borrow
     * @return loanId ID of the created loan
     */
    function depositAndBorrow(uint256 tokenType, uint256 tokenAmount) external payable returns (uint256 loanId);
    
    /**
     * @notice Repay borrowed tokens and retrieve ETH collateral
     * @param loanId ID of the loan to repay
     */
    function repay(uint256 loanId) external;
    
    /**
     * @notice Check if a loan is past due
     * @param loanId ID of the loan to check
     * @return True if loan is past due
     */
    function isPastDue(uint256 loanId) external view returns (bool);
    
    /**
     * @notice Calculate penalty for late repayment
     * @param loanId ID of the loan
     * @return Penalty amount
     */
    function calculatePenalty(uint256 loanId) external view returns (uint256);
    
    /**
     * @notice Calculate total interest accrued on a loan
     * @param loanId ID of the loan
     * @return Interest amount
     */
    function calculateInterest(uint256 loanId) external view returns (uint256);
    
    /**
     * @notice Get remaining time until loan is due
     * @param loanId ID of the loan
     * @return Time in seconds until deadline
     */
    function timeUntilDue(uint256 loanId) external view returns (uint256);
}
