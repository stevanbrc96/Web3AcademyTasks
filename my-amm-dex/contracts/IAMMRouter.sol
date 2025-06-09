// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./AMMFactory.sol";
import "./AMMPair.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IAMMRouter.sol";

contract AMMRouter {
    address public immutable factory;

    constructor(address _factory) {
        factory = _factory;
    }

    function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts) {
        require(path.length >= 2, "INVALID_PATH");
        amounts = new uint[](path.length);
        amounts[0] = amountIn;
        for (uint i = 0; i < path.length - 1; i++) {
            (uint reserveIn, uint reserveOut) = _getReserves(AMMFactory(factory).getPair(path[i], path[i+1]), path[i]);
            amounts[i+1] = _getAmountOut(amounts[i], reserveIn, reserveOut);
        }
    }


    function addLiquidity(address tokenA, address tokenB, uint amountA, uint amountB, uint deadline) external {
        require(block.timestamp <= deadline, "EXPIRED");
        address pair = AMMFactory(factory).getPair(tokenA, tokenB);
        if (pair == address(0)) {
            pair = AMMFactory(factory).createPair(tokenA, tokenB);
        }
        IERC20(tokenA).transferFrom(msg.sender, pair, amountA);
        IERC20(tokenB).transferFrom(msg.sender, pair, amountB);
        AMMPair(pair).mint(msg.sender);
    }

    function removeLiquidity(address tokenA, address tokenB, uint liquidity, uint deadline) external {
        require(block.timestamp <= deadline, "EXPIRED");
        address pair = AMMFactory(factory).getPair(tokenA, tokenB);
        require(pair != address(0), "PAIR_DOES_NOT_EXIST");
        IERC20(pair).transferFrom(msg.sender, pair, liquidity);
        AMMPair(pair).burn(msg.sender);
    }
    
    function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts) {
        amounts = getAmountsOut(amountIn, path);
        require(amounts[amounts.length - 1] >= amountOutMin, "INSUFFICIENT_OUTPUT_AMOUNT");
        require(block.timestamp <= deadline, "EXPIRED");

        address pair = AMMFactory(factory).getPair(path[0], path[1]);
        IERC20(path[0]).transferFrom(msg.sender, pair, amounts[0]);
        _swap(amounts, path, to);
    }

    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external {
        require(block.timestamp <= deadline, "EXPIRED");
        
        address pair = AMMFactory(factory).getPair(path[0], path[1]);
        (uint reserveInBefore, uint reserveOutBefore) = _getReserves(pair, path[0]);

        IERC20(path[0]).transferFrom(msg.sender, pair, amountIn);

        uint balanceInAfter = IERC20(path[0]).balanceOf(pair);
        uint amountInActual = balanceInAfter - reserveInBefore;

        uint amountOut = _getAmountOut(amountInActual, reserveInBefore, reserveOutBefore);
        require(amountOut >= amountOutMin, "INSUFFICIENT_OUTPUT_AMOUNT");

        (uint amount0Out, uint amount1Out) = path[0] < path[1] ? (uint(0), amountOut) : (amountOut, uint(0));
        
        AMMPair(pair).swap(amount0Out, amount1Out, to);
    }

    function _swap(uint[] memory amounts, address[] memory path, address _to) internal {
        for (uint i = 0; i < path.length - 1; i++) {
            address input = path[i];
            address output = path[i+1];
            address pair = AMMFactory(factory).getPair(input, output);
            (uint amount0Out, uint amount1Out) = input < output ? (uint(0), amounts[i+1]) : (amounts[i+1], uint(0));
            address target = i < path.length - 2 ? AMMFactory(factory).getPair(output, path[i+2]) : _to;
            AMMPair(pair).swap(amount0Out, amount1Out, target);
        }
    }

    function _getReserves(address pair, address tokenIn) private view returns (uint reserveIn, uint reserveOut) {
        address token0 = AMMPair(pair).token0();
        (uint reserve0, uint reserve1) = AMMPair(pair).getReserves();
        (reserveIn, reserveOut) = tokenIn == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
    }

    function _getAmountOut(uint amountIn, uint reserveIn, uint reserveOut) private pure returns (uint amountOut) {
        require(amountIn > 0, "INSUFFICIENT_INPUT_AMOUNT");
        require(reserveOut > 0, "INSUFFICIENT_LIQUIDITY");
        uint amountInWithFee = amountIn * 997;
        uint numerator = amountInWithFee * reserveOut;
        uint denominator = (reserveIn * 1000) + amountInWithFee;
        amountOut = numerator / denominator;
    }
}
