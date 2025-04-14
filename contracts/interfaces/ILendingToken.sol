// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title Lending Token Interface
 * @notice Interface for tokens used in the lending protocol
 */
interface ILendingToken {
    /**
     * @notice Returns the token name
     */
    function name() external view returns (string memory);
    
    /**
     * @notice Returns the token symbol
     */
    function symbol() external view returns (string memory);
    
    /**
     * @notice Returns the token decimals
     */
    function decimals() external view returns (uint8);
    
    /**
     * @notice Returns the token value in ETH
     */
    function tokenValue() external view returns (uint256);
    
    /**
     * @notice Returns the annual interest rate (in basis points)
     * @dev 100 basis points = 1%
     */
    function interestRate() external view returns (uint256);
    
    /**
     * @notice Mints tokens to the specified address
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) external;
    
    /**
     * @notice Burns tokens from the specified address
     * @param from Address to burn tokens from
     * @param amount Amount of tokens to burn
     */
    function burn(address from, uint256 amount) external;
    
    /**
     * @notice Calculates interest for a given principal over a time period
     * @param principal Amount of tokens
     * @param timeInSeconds Time period in seconds
     * @return Interest amount calculated
     */
    function calculateInterest(uint256 principal, uint256 timeInSeconds) external view returns (uint256);
}
