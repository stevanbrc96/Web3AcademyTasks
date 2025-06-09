// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TaxToken is ERC20, Ownable {
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) ERC20(name, symbol) Ownable(msg.sender) {
        _mint(msg.sender, initialSupply);
    }

    function transfer(address to, uint256 amount) public virtual override returns (bool) {
        address sender = _msgSender();
        
        uint256 fee = (amount * 1) / 100;
        uint256 amountAfterFee = amount - fee;

        _transfer(sender, owner(), fee);
        _transfer(sender, to, amountAfterFee);
        
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) public virtual override returns (bool) {
        address spender = _msgSender();

        _spendAllowance(from, spender, amount);

        uint256 fee = (amount * 1) / 100;
        uint256 amountAfterFee = amount - fee;

        _transfer(from, owner(), fee);
        _transfer(from, to, amountAfterFee);

        return true;
    }
}
