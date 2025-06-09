// FILE: test/fee-on-transfer.js (Popravljeno)

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AMM DEX with Fee-on-Transfer Tokens", function () {
  let tokenA, taxToken, factory, router;
  let owner, user1;
  let deadline;

  beforeEach(async function () {
    [owner, user1] = await ethers.getSigners();
    deadline = BigInt(Math.floor(Date.now() / 1000)) + BigInt(60 * 10);

    const TokenAFactory = await ethers.getContractFactory("TokenA");
    tokenA = await TokenAFactory.deploy(ethers.parseUnits("1000000", 18));
    await tokenA.waitForDeployment();

    const TaxTokenFactory = await ethers.getContractFactory("TaxToken");
    // Provjerite da li TaxToken konstruktor prima 3 argumenta (name, symbol, initialSupply)
    taxToken = await TaxTokenFactory.deploy("Tax Token", "TAXT", ethers.parseUnits("1000000", 18));
    await taxToken.waitForDeployment();

    const AMMFactory = await ethers.getContractFactory("AMMFactory");
    factory = await AMMFactory.deploy();
    await factory.waitForDeployment();

    const AMMRouterFactory = await ethers.getContractFactory("contracts/AMMrouter.sol:AMMRouter");
    router = await AMMRouterFactory.deploy(await factory.getAddress());
    await router.waitForDeployment();

    await factory.createPair(await tokenA.getAddress(), await taxToken.getAddress());
    
    await tokenA.transfer(user1.address, ethers.parseUnits("10000", 18));
    await taxToken.transfer(user1.address, ethers.parseUnits("10000", 18));

    const amountA = ethers.parseUnits("1000", 18);
    const amountTax = ethers.parseUnits("1000", 18);
    await tokenA.connect(user1).approve(await router.getAddress(), amountA);
    await taxToken.connect(user1).approve(await router.getAddress(), amountTax);
    
    // <-- DODAT 'to' argument u addLiquidity pozivu
    await router.connect(user1).addLiquidity(
      await tokenA.getAddress(),
      await taxToken.getAddress(),
      amountA,
      amountTax,
      user1.address, // <-- DODATO
      deadline
    );
  });

  it("Should fail to swap with the standard swap function", async function () {
    const swapAmount = ethers.parseUnits("100", 18);
    await taxToken.connect(user1).approve(await router.getAddress(), swapAmount);
    
    const path = [await taxToken.getAddress(), await tokenA.getAddress()];
    
    await expect(
      router.connect(user1).swapExactTokensForTokens(
        swapAmount,
        BigInt(0), // <-- Koristimo BigInt(0)
        path,
        user1.address,
        deadline
      )
    ).to.be.reverted;
  });

  it("Should successfully swap with the fee-supporting swap function", async function () {
    const swapAmount = ethers.parseUnits("100", 18);
    await taxToken.connect(user1).approve(await router.getAddress(), swapAmount);

    const path = [await taxToken.getAddress(), await tokenA.getAddress()];
    const userBalanceBefore = await tokenA.balanceOf(user1.address);
    
    await expect(
      router.connect(user1).swapExactTokensForTokensSupportingFeeOnTransferTokens(
        swapAmount,
        BigInt(0), // <-- Koristimo BigInt(0)
        path,
        user1.address,
        deadline
      )
    ).to.not.be.reverted;

    const userBalanceAfter = await tokenA.balanceOf(user1.address);
    expect(userBalanceAfter).to.be.gt(userBalanceBefore);
  });
});