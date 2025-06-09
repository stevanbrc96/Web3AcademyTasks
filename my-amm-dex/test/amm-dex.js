const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AMM DEX", function () {
  let tokenA, tokenB, factory, router, pair;
  let owner, user1, user2;
  let deadline;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    
    deadline = Math.floor(Date.now() / 1000) + 60 * 10;

    const TokenAFactory = await ethers.getContractFactory("TokenA");
    tokenA = await TokenAFactory.deploy(ethers.parseUnits("1000000", 18));
    await tokenA.waitForDeployment();

    const TokenBFactory = await ethers.getContractFactory("TokenB");
    tokenB = await TokenBFactory.deploy(ethers.parseUnits("1000000", 18));
    await tokenB.waitForDeployment();

    const AMMFactoryFactory = await ethers.getContractFactory("AMMFactory");
    factory = await AMMFactoryFactory.deploy();
    await factory.waitForDeployment();

    const AMMRouterFactory = await ethers.getContractFactory("AMMRouter");
    router = await AMMRouterFactory.deploy(await factory.getAddress());
    await router.waitForDeployment();

    await factory.createPair(await tokenA.getAddress(), await tokenB.getAddress());
    const pairAddress = await factory.getPair(await tokenA.getAddress(), await tokenB.getAddress());
    pair = await ethers.getContractAt("AMMPair", pairAddress);

    await tokenA.transfer(user1.address, ethers.parseUnits("10000", 18));
    await tokenB.transfer(user1.address, ethers.parseUnits("10000", 18));
    await tokenA.transfer(user2.address, ethers.parseUnits("10000", 18));
    await tokenB.transfer(user2.address, ethers.parseUnits("10000", 18));
  });

  it("Should add liquidity", async function () {
    const amountA = ethers.parseUnits("1000", 18);
    const amountB = ethers.parseUnits("1000", 18);

    await tokenA.connect(user1).approve(await router.getAddress(), amountA);
    await tokenB.connect(user1).approve(await router.getAddress(), amountB);

    await expect(
      router.connect(user1).addLiquidity(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        amountA,
        amountB,
        deadline
      )
    ).to.emit(pair, "Mint");

    const lpBal = await pair.balanceOf(user1.address);
    expect(lpBal).to.be.gt(0);
  });

  it("Should swap tokens", async function () {
    const amountA = ethers.parseUnits("1000", 18);
    const amountB = ethers.parseUnits("1000", 18);
    await tokenA.connect(user1).approve(await router.getAddress(), amountA);
    await tokenB.connect(user1).approve(await router.getAddress(), amountB);
    await router.connect(user1).addLiquidity(
      await tokenA.getAddress(),
      await tokenB.getAddress(),
      amountA,
      amountB,
      deadline
    );

    const swapAmount = ethers.parseUnits("10", 18);
    await tokenA.connect(user2).approve(await router.getAddress(), swapAmount);

    const balBBefore = await tokenB.balanceOf(user2.address);

    const path = [await tokenA.getAddress(), await tokenB.getAddress()];
    await expect(
      router.connect(user2).swapExactTokensForTokens(
        swapAmount,
        0, 
        path,
        user2.address,
        deadline
      )
    ).to.emit(pair, "Swap");

    const balBAfter = await tokenB.balanceOf(user2.address);
    expect(balBAfter).to.be.gt(balBBefore);
  });

  it("Should remove liquidity", async function () {
    const amountA = ethers.parseUnits("1000", 18);
    const amountB = ethers.parseUnits("1000", 18);
    await tokenA.connect(user1).approve(await router.getAddress(), amountA);
    await tokenB.connect(user1).approve(await router.getAddress(), amountB);
    await router.connect(user1).addLiquidity(
      await tokenA.getAddress(),
      await tokenB.getAddress(),
      amountA,
      amountB,
      deadline
    );

    const lpBal = await pair.balanceOf(user1.address);
    
    await pair.connect(user1).approve(await router.getAddress(), lpBal);
    
    await expect(
      router.connect(user1).removeLiquidity(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        lpBal,
        deadline
      )
    ).to.emit(pair, "Burn");

    const lpBalAfter = await pair.balanceOf(user1.address);
    expect(lpBalAfter).to.equal(0);
  });
});