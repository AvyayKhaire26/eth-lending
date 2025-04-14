// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/ILendingToken.sol";

contract PremiumLoanToken is ERC20, Ownable, ILendingToken {
    // Token value in ETH (0.75 ETH)
    uint256 private constant _TOKEN_VALUE = 750000000000000000;
    
    // Interest rate in basis points (12% annual = 1200 basis points)
    uint256 private constant _INTEREST_RATE = 1200;
    
    constructor() ERC20("Premium Loan Token", "PLT") Ownable(msg.sender) {}
    
    // Override functions to resolve conflicts
    function name() public view virtual override(ERC20, ILendingToken) returns (string memory) {
        return ERC20.name();
    }
    
    function symbol() public view virtual override(ERC20, ILendingToken) returns (string memory) {
        return ERC20.symbol();
    }
    
    function decimals() public view virtual override(ERC20, ILendingToken) returns (uint8) {
        return ERC20.decimals();
    }
    
    function tokenValue() external pure override returns (uint256) {
        return _TOKEN_VALUE;
    }
    
    function interestRate() external pure override returns (uint256) {
        return _INTEREST_RATE;
    }
    
    function mint(address to, uint256 amount) external override onlyOwner {
        _mint(to, amount);
    }
    
    function burn(address from, uint256 amount) external override onlyOwner {
        _burn(from, amount);
    }
    
    function calculateInterest(uint256 principal, uint256 timeInSeconds) external pure override returns (uint256) {
        uint256 interestPerSecond = (_INTEREST_RATE * principal) / (10000 * 31536000);
        return interestPerSecond * timeInSeconds;
    }
}
