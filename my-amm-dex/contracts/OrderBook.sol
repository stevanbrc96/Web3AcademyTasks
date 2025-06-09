// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IAMMRouter {
    function factory() external view returns (address);

    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
    
    function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts);
}

contract OrderBook {
    IAMMRouter public immutable router;
    
    uint256 public nextOrderId;

    enum Status { Open, Filled, Cancelled }

    struct Order {
        uint256 id;
        address owner;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 amountOutMin; 
        Status status;
    }

    mapping(uint256 => Order) public orders;

    event OrderCreated(uint256 id, address owner, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOutMin);
    event OrderCancelled(uint256 id);
    event OrderFilled(uint256 id, uint256 amountOut);

    constructor(address _routerAddress) {
        router = IAMMRouter(_routerAddress);
    }


    function createOrder(
        address _tokenIn,
        address _tokenOut,
        uint256 _amountIn,
        uint256 _amountOutMin
    ) external {
        require(_amountIn > 0 && _amountOutMin > 0, "OrderBook: AMOUNTS_MUST_BE_POSITIVE");
        require(_tokenIn != _tokenOut, "OrderBook: IDENTICAL_TOKENS");

        IERC20(_tokenIn).transferFrom(msg.sender, address(this), _amountIn);

        uint256 orderId = nextOrderId;
        orders[orderId] = Order({
            id: orderId,
            owner: msg.sender,
            tokenIn: _tokenIn,
            tokenOut: _tokenOut,
            amountIn: _amountIn,
            amountOutMin: _amountOutMin,
            status: Status.Open
        });

        nextOrderId++;

        emit OrderCreated(orderId, msg.sender, _tokenIn, _tokenOut, _amountIn, _amountOutMin);
    }

    function cancelOrder(uint256 _orderId) external {
        Order storage order = orders[_orderId];

        require(msg.sender == order.owner, "OrderBook: NOT_OWNER");
        require(order.status == Status.Open, "OrderBook: ORDER_NOT_OPEN");

        order.status = Status.Cancelled;

        IERC20(order.tokenIn).transfer(order.owner, order.amountIn);

        emit OrderCancelled(_orderId);
    }


    function executeOrder(uint256 _orderId) external {
        Order storage order = orders[_orderId];

        require(order.status == Status.Open, "OrderBook: ORDER_NOT_OPEN");

        address[] memory path = new address[](2);
        path[0] = order.tokenIn;
        path[1] = order.tokenOut;
        
        uint[] memory amountsOut = router.getAmountsOut(order.amountIn, path);
        uint256 currentAmountOut = amountsOut[1];

        require(currentAmountOut >= order.amountOutMin, "OrderBook: PRICE_NOT_MET");

        IERC20(order.tokenIn).approve(address(router), order.amountIn);

        router.swapExactTokensForTokens(
            order.amountIn,
            order.amountOutMin, 
            path,
            order.owner, 
            block.timestamp
        );
        
        order.status = Status.Filled;

        emit OrderFilled(_orderId, currentAmountOut);
    }
}
