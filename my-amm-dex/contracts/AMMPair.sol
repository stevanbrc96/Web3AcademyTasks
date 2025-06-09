// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract AMMPair is ERC20 {
    address public immutable factory;
    address public immutable token0;
    address public immutable token1;

    uint public reserve0;
    uint public reserve1;

    event Mint(address indexed sender, uint amount0, uint amount1);
    event Burn(address indexed sender, uint amount0, uint amount1, address indexed to);
    event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to);
    event Sync(uint reserve0, uint reserve1);

    constructor(address _token0, address _token1) ERC20("AMM-LPToken", "ALP") {
        factory = msg.sender;
        (token0, token1) = _token0 < _token1 ? (_token0, _token1) : (_token1, _token0);
    }


    function getReserves() external view returns (uint _reserve0, uint _reserve1) {
        _reserve0 = reserve0;
        _reserve1 = reserve1;
    }

    function _update(uint _balance0, uint _balance1) private {
        reserve0 = _balance0;
        reserve1 = _balance1;
        emit Sync(_balance0, _balance1);
    }
    
    function mint(address to) external returns (uint liquidity) {
        (uint _reserve0, uint _reserve1) = (reserve0, reserve1);
        uint balance0 = IERC20(token0).balanceOf(address(this));
        uint balance1 = IERC20(token1).balanceOf(address(this));
        uint amount0 = balance0 - _reserve0;
        uint amount1 = balance1 - _reserve1;

        uint _totalSupply = totalSupply();
        if (_totalSupply == 0) {
            liquidity = sqrt(amount0 * amount1);
        } else {
            liquidity = min((amount0 * _totalSupply) / _reserve0, (amount1 * _totalSupply) / _reserve1);
        }
        require(liquidity > 0, "INSUFFICIENT_LIQUIDITY_MINTED");
        _mint(to, liquidity);
        _update(balance0, balance1);
        emit Mint(msg.sender, amount0, amount1);
    }

    function burn(address to) external returns (uint amount0, uint amount1) {
        (uint _reserve0, uint _reserve1) = (reserve0, reserve1);
        uint liquidity = balanceOf(address(this));
        uint _totalSupply = totalSupply();
        amount0 = (liquidity * _reserve0) / _totalSupply;
        amount1 = (liquidity * _reserve1) / _totalSupply;
        require(amount0 > 0 && amount1 > 0, "INSUFFICIENT_LIQUIDITY_BURNED");
        _burn(address(this), liquidity);
        _safeTransfer(token0, to, amount0);
        _safeTransfer(token1, to, amount1);
        uint balance0 = IERC20(token0).balanceOf(address(this));
        uint balance1 = IERC20(token1).balanceOf(address(this));
        _update(balance0, balance1);
        emit Burn(msg.sender, amount0, amount1, to);
    }

    function swap(uint amount0Out, uint amount1Out, address to) external {
        require(amount0Out < reserve0 && amount1Out < reserve1, "INSUFFICIENT_LIQUIDITY");
        if (amount0Out > 0) _safeTransfer(token0, to, amount0Out);
        if (amount1Out > 0) _safeTransfer(token1, to, amount1Out);
        uint balance0 = IERC20(token0).balanceOf(address(this));
        uint balance1 = IERC20(token1).balanceOf(address(this));
        uint amount0In = balance0 > reserve0 - amount0Out ? balance0 - (reserve0 - amount0Out) : 0;
        uint amount1In = balance1 > reserve1 - amount1Out ? balance1 - (reserve1 - amount1Out) : 0;
        require(amount0In > 0 || amount1In > 0, "INSUFFICIENT_INPUT_AMOUNT");
        uint balance0Adjusted = (balance0 * 1000) - (amount0In * 3);
        uint balance1Adjusted = (balance1 * 1000) - (amount1In * 3);
        require(balance0Adjusted * balance1Adjusted >= reserve0 * reserve1 * 1000**2, "K_CONSTANT_INVALID");
        _update(balance0, balance1);
        emit Swap(msg.sender, amount0In, amount1In, amount0Out, amount1Out, to);
    }
    
    function _safeTransfer(address token, address to, uint value) private {
        (bool success, bytes memory data) = token.call(abi.encodeWithSignature("transfer(address,uint256)", to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), "TRANSFER_FAILED");
    }
    
    function min(uint x, uint y) private pure returns (uint) { return x < y ? x : y; }
    function sqrt(uint y) private pure returns (uint z) {
        if (y > 3) {
            z = y;
            uint x = y / 2 + 1;
            while (x < z) { z = x; x = (y / x + x) / 2; }
        } else if (y != 0) { z = 1; }
    }
}