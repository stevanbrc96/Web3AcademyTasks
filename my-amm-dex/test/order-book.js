// FILE: test/order-book.js (Popravljeno)

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("OrderBook Contract", function () {
  let tokenA, tokenB, factory, router, orderBook;
  let owner, user1, keeper;
  let deadline;

  beforeEach(async function () {
    [owner, user1, keeper] = await ethers.getSigners();
    
    deadline = BigInt(Math.floor(Date.now() / 1000)) + BigInt(60 * 10);

    const TokenAFactory = await ethers.getContractFactory("TokenA");
    tokenA = await TokenAFactory.deploy(ethers.parseUnits("2000000", 18));
    await tokenA.waitForDeployment();
    const TokenBFactory = await ethers.getContractFactory("TokenB");
    tokenB = await TokenBFactory.deploy(ethers.parseUnits("2000000", 18));
    await tokenB.waitForDeployment();

    const AMMFactory = await ethers.getContractFactory("AMMFactory");
    factory = await AMMFactory.deploy();
    await factory.waitForDeployment();
    
    const AMMRouterFactory = await ethers.getContractFactory("contracts/AMMrouter.sol:AMMRouter");
    router = await AMMRouterFactory.deploy(await factory.getAddress());
    await router.waitForDeployment();

    const OrderBook = await ethers.getContractFactory("OrderBook");
    orderBook = await OrderBook.deploy(await router.getAddress());
    await orderBook.waitForDeployment();

    const amountA = ethers.parseUnits("100000", 18);
    const amountB = ethers.parseUnits("100000", 18);
    await tokenA.approve(await router.getAddress(), amountA);
    await tokenB.approve(await router.getAddress(), amountB);
    
    // <-- DODAT 'to' argument u addLiquidity pozivu
    await router.addLiquidity(
      await tokenA.getAddress(),
      await tokenB.getAddress(),
      amountA,
      amountB,
      owner.address, // <-- DODATO (likvidnost dodaje owner)
      deadline
    );

    await tokenA.transfer(user1.address, ethers.parseUnits("1000", 18));
  });

  it("Should allow a user to create and cancel an order", async function () {
    const amountIn = ethers.parseUnits("100", 18);
    const amountOutMin = ethers.parseUnits("95", 18);
    await tokenA.connect(user1).approve(await orderBook.getAddress(), amountIn);

    await expect(
      orderBook.connect(user1).createOrder(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        amountIn,
        amountOutMin
      )
    ).to.emit(orderBook, "OrderCreated");

    const balanceBefore = await tokenA.balanceOf(user1.address);
    // orderId 0
    await expect(orderBook.connect(user1).cancelOrder(BigInt(0))).to.emit(orderBook, "OrderCancelled"); // <-- Koristimo BigInt(0)
    const balanceAfter = await tokenA.balanceOf(user1.address);
    // Koristimo BigInt sabiranje
    expect(balanceAfter).to.equal(balanceBefore + amountIn); 
  });

  it("Should allow a keeper to execute an order when the price is favorable", async function () {
    const amountIn = ethers.parseUnits("10", 18);
    const amountOutMin = ethers.parseUnits("15", 18); 
    await tokenA.connect(user1).approve(await orderBook.getAddress(), amountIn);
    await orderBook.connect(user1).createOrder(
      await tokenA.getAddress(), 
      await tokenB.getAddress(), 
      amountIn, 
      amountOutMin
    );

    // orderId 0
    await expect(orderBook.connect(keeper).executeOrder(BigInt(0))) // <-- Koristimo BigInt(0)
      .to.be.revertedWith("OrderBook: PRICE_NOT_MET");

    const swapAmount = ethers.parseUnits("50000", 18);
    await tokenB.approve(await router.getAddress(), swapAmount);
    await router.swapExactTokensForTokens(
      swapAmount, BigInt(0), [await tokenB.getAddress(), await tokenA.getAddress()], owner.address, deadline // <-- Koristimo BigInt(0)
    );

    const userBalanceBefore = await tokenB.balanceOf(user1.address);
    
    // orderId 0
    await expect(orderBook.connect(keeper).executeOrder(BigInt(0))) // <-- Koristimo BigInt(0)
      .to.emit(orderBook, "OrderFilled");

    const userBalanceAfter = await tokenB.balanceOf(user1.address);
    expect(userBalanceAfter).to.be.gt(userBalanceBefore);
    // Koristimo BigInt oduzimanje
    expect(userBalanceAfter - userBalanceBefore).to.be.gte(amountOutMin); 

    const order = await orderBook.orders(BigInt(0)); // <-- Koristimo BigInt(0)
    expect(order.status).to.equal(1);
  });
});