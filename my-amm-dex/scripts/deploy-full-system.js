// FILE: deploy.js

const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying the full AMM system including tokens and OrderBook...");

  const [deployer] = await ethers.getSigners();
  console.log(`Deploying contracts with the account: ${deployer.address}`);

    // --- DEPLOY TEST ERC-20 TOKENS ---
    // Now passing only the initialSupply argument, as per TokenA.sol's constructor
    const TokenAFactory = await ethers.getContractFactory("TokenA");
    const tokenA = await TokenAFactory.deploy(ethers.parseUnits("1000000", 18)); // <--- CORRECTED: Only initialSupply
    await tokenA.waitForDeployment();
    console.log(`✓ Token A deployed to: ${await tokenA.getAddress()}`);

    // Assuming TokenB.sol has the same constructor as TokenA.sol
    const TokenBFactory = await ethers.getContractFactory("TokenB");
    const tokenB = await TokenBFactory.deploy(ethers.parseUnits("1000000", 18)); // <--- CORRECTED: Only initialSupply
    await tokenB.waitForDeployment();
    console.log(`✓ Token B deployed to: ${await tokenB.getAddress()}`);
    // --- END DEPLOY TEST ERC-20 TOKENS ---


  const AMMFactory = await ethers.getContractFactory("AMMFactory");
  const factory = await AMMFactory.deploy();
  await factory.waitForDeployment();
  console.log(`✓ AMMFactory deployed to: ${await factory.getAddress()}`);

  const AMMRouterFactory = await ethers.getContractFactory("contracts/AMMrouter.sol:AMMRouter");
  const router = await AMMRouterFactory.deploy(await factory.getAddress());
  await router.waitForDeployment();
  console.log(`✓ AMMRouter deployed to: ${await router.getAddress()}`);

  const OrderBook = await ethers.getContractFactory("OrderBook");
  const orderBook = await OrderBook.deploy(await router.getAddress());
  await orderBook.waitForDeployment();
  console.log(`✓ OrderBook deployed to: ${await orderBook.getAddress()}`);

  console.log("\n--- Deployment Complete ---");
  console.log("--- COPY THESE ADDRESSES TO YOUR contracts.js FILE ---");
  console.log(`FACTORY_ADDRESS = "${await factory.getAddress()}"`);
  console.log(`ROUTER_ADDRESS = "${await router.getAddress()}"`);
  console.log(`TOKEN_A_ADDRESS = "${await tokenA.getAddress()}"`); 
  console.log(`TOKEN_B_ADDRESS = "${await tokenB.getAddress()}"`); 
  console.log(`ORDER_BOOK_ADDRESS = "${await orderBook.getAddress()}"`);
  console.log("----------------------------------------------------");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});