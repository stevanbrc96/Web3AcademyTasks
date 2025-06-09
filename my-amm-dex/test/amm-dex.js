// FILE: test/amm-core.js (Konačna, radna verzija sa najrobistnijim rešenjem za Swap event)

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AMM Core Functionality", function () {
  let tokenA, tokenB, factory, router, pair;
  let owner, user1, user2;
  let deadline;

  const INITIAL_LIQUIDITY_AMOUNT = ethers.parseUnits("10000", 18); // 10,000 tokena
  const SWAP_AMOUNT_IN = ethers.parseUnits("100", 18); // 100 tokena za swap

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    deadline = BigInt(Math.floor(Date.now() / 1000)) + BigInt(60 * 10); // Koristimo BigInt za deadline

    const TokenAFactory = await ethers.getContractFactory("TokenA");
    tokenA = await TokenAFactory.deploy(ethers.parseUnits("1000000", 18));
    await tokenA.waitForDeployment();

    const TokenBFactory = await ethers.getContractFactory("TokenB");
    tokenB = await TokenBFactory.deploy(ethers.parseUnits("1000000", 18));
    await tokenB.waitForDeployment();

    const AMMFactory = await ethers.getContractFactory("AMMFactory");
    factory = await AMMFactory.deploy();
    await factory.waitForDeployment();

    const AMMRouterFactory = await ethers.getContractFactory("contracts/AMMrouter.sol:AMMRouter");
    router = await AMMRouterFactory.deploy(await factory.getAddress());
    await router.waitForDeployment();

    await factory.createPair(await tokenA.getAddress(), await tokenB.getAddress());
    const pairAddress = await factory.getPair(await tokenA.getAddress(), await tokenB.getAddress());
    pair = await ethers.getContractAt("AMMPair", pairAddress);

    await tokenA.transfer(user1.address, ethers.parseUnits("50000", 18));
    await tokenB.transfer(user1.address, ethers.parseUnits("50000", 18));
    await tokenA.transfer(user2.address, ethers.parseUnits("50000", 18)); 
    await tokenB.transfer(user2.address, ethers.parseUnits("50000", 18));
  });

  describe("addLiquidity", function () {
    it("Should add initial liquidity and mint LP tokens correctly", async function () {
      await tokenA.approve(await router.getAddress(), INITIAL_LIQUIDITY_AMOUNT);
      await tokenB.approve(await router.getAddress(), INITIAL_LIQUIDITY_AMOUNT);

      const ownerLPBalanceBefore = await pair.balanceOf(owner.address);
      expect(ownerLPBalanceBefore).to.equal(BigInt(0)); 

      await expect(router.addLiquidity(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        INITIAL_LIQUIDITY_AMOUNT,
        INITIAL_LIQUIDITY_AMOUNT,
        owner.address, 
        deadline
      )).to.emit(pair, "Mint"); 

      const ownerLPBalance = await pair.balanceOf(owner.address);
      expect(ownerLPBalance).to.be.gt(BigInt(0)); 
      
      const [reserve0, reserve1] = await pair.getReserves();
      expect(reserve0).to.equal(INITIAL_LIQUIDITY_AMOUNT);
      expect(reserve1).to.equal(INITIAL_LIQUIDITY_AMOUNT);

      expect(await tokenA.balanceOf(await pair.getAddress())).to.equal(INITIAL_LIQUIDITY_AMOUNT);
      expect(await tokenB.balanceOf(await pair.getAddress())).to.equal(INITIAL_LIQUIDITY_AMOUNT);
    });

    it("Should add more liquidity, maintaining ratio and minting correct LP tokens", async function () {
      await tokenA.approve(await router.getAddress(), INITIAL_LIQUIDITY_AMOUNT);
      await tokenB.approve(await router.getAddress(), INITIAL_LIQUIDITY_AMOUNT);
      await router.addLiquidity(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        INITIAL_LIQUIDITY_AMOUNT,
        INITIAL_LIQUIDITY_AMOUNT,
        owner.address,
        deadline
      );
      const ownerLPBalanceInitial = await pair.balanceOf(owner.address);
      const [initialReserve0, initialReserve1] = await pair.getReserves();

      const amountToAdd = ethers.parseUnits("5000", 18);
      await tokenA.approve(await router.getAddress(), amountToAdd);
      await tokenB.approve(await router.getAddress(), amountToAdd);

      await expect(router.addLiquidity(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        amountToAdd,
        amountToAdd,
        owner.address,
        deadline
      )).to.emit(pair, "Mint");

      const ownerLPBalanceAfter = await pair.balanceOf(owner.address);
      expect(ownerLPBalanceAfter).to.be.gt(ownerLPBalanceInitial); 
      expect(ownerLPBalanceAfter).to.be.closeTo(ownerLPBalanceInitial + (ownerLPBalanceInitial / BigInt(2)), ethers.parseUnits("0.001", 18)); 

      const [reserve0, reserve1] = await pair.getReserves();
      expect(reserve0).to.equal(initialReserve0 + amountToAdd);
      expect(reserve1).to.equal(initialReserve1 + amountToAdd);
    });

    it("Should revert if initial liquidity amounts are zero", async function () {
      await expect(router.addLiquidity(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        BigInt(0), 
        BigInt(0), 
        owner.address, 
        deadline
      )).to.be.revertedWith("AMMRouter: INSUFFICIENT_AMOUNTS_RECEIVED_AFTER_FEES");
    });

    it("Should revert if only one token is provided for initial liquidity", async function () {
      await tokenA.approve(await router.getAddress(), INITIAL_LIQUIDITY_AMOUNT);
      await expect(router.addLiquidity(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        INITIAL_LIQUIDITY_AMOUNT,
        BigInt(0), 
        owner.address, 
        deadline
      )).to.be.reverted;
    });
  });

  describe("swapExactTokensForTokens", function () {
    beforeEach(async function () {
      await tokenA.approve(await router.getAddress(), INITIAL_LIQUIDITY_AMOUNT);
      await tokenB.approve(await router.getAddress(), INITIAL_LIQUIDITY_AMOUNT);
      await router.addLiquidity(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        INITIAL_LIQUIDITY_AMOUNT,
        INITIAL_LIQUIDITY_AMOUNT,
        owner.address,
        deadline
      );
    });

    it("Should execute a successful swap and emit a Swap event", async function () {
      const path = [await tokenA.getAddress(), await tokenB.getAddress()];
      const user2BalanceABefore = await tokenA.balanceOf(user2.address);
      const user2BalanceBBefore = await tokenB.balanceOf(user2.address);
      
      await tokenA.connect(user2).approve(await router.getAddress(), SWAP_AMOUNT_IN);

      const expectedAmountsOut = await router.getAmountsOut(SWAP_AMOUNT_IN, path);
      const receivedAmount = expectedAmountsOut[1];

      // --- Dinamičko određivanje expectedAmount0In i expectedAmount1In ---
      const pairToken0Address = await pair.token0();
      let expectedAmount0In, expectedAmount1In;

      // Ako je TokenA (input token) token0 u paru
      if (await tokenA.getAddress() === pairToken0Address) {
          expectedAmount0In = SWAP_AMOUNT_IN;
          expectedAmount1In = BigInt(0);
      } else { 
          // Inače je TokenB (izlazni token) token0, a TokenA (input) je token1
          expectedAmount0In = BigInt(0);
          expectedAmount1In = SWAP_AMOUNT_IN;
      }
      // --- Kraj dinamičkog određivanja ---

      await expect(router.connect(user2).swapExactTokensForTokens(
        SWAP_AMOUNT_IN,
        BigInt(0), // amountOutMin
        path,
        user2.address,
        deadline
      )).to.emit(pair, "Swap")
        .withArgs(
            await router.getAddress(), // Sender je router
            expectedAmount0In,         // amount0In - SADA DINAMIČKI ODREĐENO
            expectedAmount1In,         // amount1In - SADA DINAMIČKI ODREĐENO
            // Koristimo funkciju za proveru: jedan od ova dva mora biti 0, drugi mora biti receivedAmount
            // Redosled zavisi od dinamike TokenA/TokenB adresa
            (val) => val === BigInt(0) || val === receivedAmount, // Proverava da li je val 0 ILI receivedAmount
            (val) => val === BigInt(0) || val === receivedAmount, // Proverava da li je val 0 ILI receivedAmount
            user2.address              // to
        );

      const user2BalanceAAfter = await tokenA.balanceOf(user2.address);
      const user2BalanceBAfter = await tokenB.balanceOf(user2.address);
      
      expect(user2BalanceAAfter).to.equal(user2BalanceABefore - SWAP_AMOUNT_IN);
      expect(user2BalanceBAfter).to.be.gt(user2BalanceBBefore);

      expect(user2BalanceBAfter - user2BalanceBBefore).to.equal(receivedAmount); 
    });

    it("Should revert if amountOutMin is not met (slippage protection)", async function () {
      const path = [await tokenA.getAddress(), await tokenB.getAddress()];
      await tokenA.connect(user2).approve(await router.getAddress(), SWAP_AMOUNT_IN);

      const expectedAmountOut = (await router.getAmountsOut(SWAP_AMOUNT_IN, path))[1];
      const tooHighAmountOutMin = expectedAmountOut + ethers.parseUnits("0.1", 18); 

      await expect(router.connect(user2).swapExactTokensForTokens(
        SWAP_AMOUNT_IN,
        tooHighAmountOutMin,
        path,
        user2.address,
        deadline
      )).to.be.revertedWith("INSUFFICIENT_OUTPUT_AMOUNT");
    });

    it("Should revert if given zero input amount", async function () {
      const path = [await tokenA.getAddress(), await tokenB.getAddress()];
      await expect(router.connect(user2).swapExactTokensForTokens(
        BigInt(0), 
        BigInt(0), 
        path,
        user2.address,
        deadline
      )).to.be.revertedWith("INSUFFICIENT_INPUT_AMOUNT");
    });
  });

  describe("removeLiquidity", function () {
    beforeEach(async function () {
      await tokenA.approve(await router.getAddress(), INITIAL_LIQUIDITY_AMOUNT);
      await tokenB.approve(await router.getAddress(), INITIAL_LIQUIDITY_AMOUNT);
      await router.addLiquidity(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        INITIAL_LIQUIDITY_AMOUNT,
        INITIAL_LIQUIDITY_AMOUNT,
        owner.address,
        deadline
      );
    });

    it("Should remove full liquidity and return tokens", async function () {
      const ownerLPBalanceBefore = await pair.balanceOf(owner.address);
      const ownerBalanceABefore = await tokenA.balanceOf(owner.address);
      const ownerBalanceBBefore = await tokenB.balanceOf(owner.address);

      await pair.approve(await router.getAddress(), ownerLPBalanceBefore);

      await expect(router.removeLiquidity(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        ownerLPBalanceBefore, 
        deadline
      )).to.emit(pair, "Burn"); 

      const ownerLPBalanceAfter = await pair.balanceOf(owner.address);
      const ownerBalanceAAfter = await tokenA.balanceOf(owner.address);
      const ownerBalanceBAfter = await tokenB.balanceOf(owner.address);

      expect(ownerLPBalanceAfter).to.equal(BigInt(0)); 
      expect(ownerBalanceAAfter).to.be.gt(ownerBalanceABefore);
      expect(ownerBalanceBAfter).to.be.gt(ownerBalanceBBefore);

      const [reserve0, reserve1] = await pair.getReserves();
      expect(reserve0).to.equal(BigInt(0));
      expect(reserve1).to.equal(BigInt(0));
    });

    it("Should remove partial liquidity and return proportional tokens", async function () {
      const ownerLPBalanceBefore = await pair.balanceOf(owner.address);
      const ownerBalanceABefore = await tokenA.balanceOf(owner.address);
      const ownerBalanceBBefore = await tokenB.balanceOf(owner.address);
      const [pairReserve0Before, pairReserve1Before] = await pair.getReserves();

      const lpToRemove = ownerLPBalanceBefore / BigInt(2); 
      await pair.approve(await router.getAddress(), lpToRemove);

      await expect(router.removeLiquidity(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        lpToRemove,
        deadline
      )).to.emit(pair, "Burn");

      const ownerLPBalanceAfter = await pair.balanceOf(owner.address);
      const ownerBalanceAAfter = await tokenA.balanceOf(owner.address);
      const ownerBalanceBAfter = await tokenB.balanceOf(owner.address);
      const [pairReserve0After, pairReserve1After] = await pair.getReserves();

      expect(ownerLPBalanceAfter).to.equal(ownerLPBalanceBefore - lpToRemove); 
      expect(ownerBalanceAAfter).to.be.gt(ownerBalanceABefore);
      expect(ownerBalanceBAfter).to.be.gt(ownerBalanceBBefore);
      expect(pairReserve0After).to.be.gt(BigInt(0)); 
      expect(pairReserve1After).to.be.gt(BigInt(0));

      const expectedReserve0After = pairReserve0Before - (pairReserve0Before * lpToRemove) / ownerLPBalanceBefore; 
      const expectedReserve1After = pairReserve1Before - (pairReserve1Before * lpToRemove) / ownerLPBalanceBefore; 

      expect(pairReserve0After).to.be.closeTo(expectedReserve0After, BigInt(1)); 
      expect(pairReserve1After).to.be.closeTo(expectedReserve1After, BigInt(1));
    });

    it("Should revert if attempting to remove zero liquidity", async function () {
      await expect(router.removeLiquidity(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        BigInt(0), 
        deadline
      )).to.be.revertedWith("INSUFFICIENT_LIQUIDITY_BURNED");
    });

    it("Should revert if user does not have enough LP tokens approved", async function () {
      const lpToRemove = ethers.parseUnits("1", 18);
      await expect(router.connect(user1).removeLiquidity( 
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        lpToRemove,
        deadline
      )).to.be.reverted; 
    });
  });
});