const { ethers } = require("hardhat");

async function main() {
  // Get deployer account
  const [deployer] = await ethers.getSigners();

  // Deploy TokenA
  const TokenA = await ethers.getContractFactory("TokenA");
  const tokenA = await TokenA.deploy(ethers.parseUnits("1000000", 18));
  await tokenA.waitForDeployment();
  const tokenAAddress = await tokenA.getAddress();
  console.log("TokenA deployed to:", tokenAAddress);

  // Deploy TokenB
  const TokenB = await ethers.getContractFactory("TokenB");
  const tokenB = await TokenB.deploy(ethers.parseUnits("1000000", 18));
  await tokenB.waitForDeployment();
  const tokenBAddress = await tokenB.getAddress();
  console.log("TokenB deployed to:", tokenBAddress);

  // Deploy AMMFactory
  const Factory = await ethers.getContractFactory("AMMFactory");
  const factory = await Factory.deploy();
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("AMMFactory deployed to:", factoryAddress);

  // Deploy AMMRouter
  const Router = await ethers.getContractFactory("AMMRouter");
  const router = await Router.deploy(factoryAddress);
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();
  console.log("AMMRouter deployed to:", routerAddress);

  // Create Pair (TokenA, TokenB)
  const tx = await factory.createPair(tokenAAddress, tokenBAddress);
  await tx.wait();
  const pairAddress = await factory.getPair(tokenAAddress, tokenBAddress);
  console.log("Pair deployed to:", pairAddress);

  // Output all addresses for frontend usage
  console.log(`
  Addresses for frontend:
  TOKEN_A_ADDRESS: "${tokenAAddress}"
  TOKEN_B_ADDRESS: "${tokenBAddress}"
  FACTORY_ADDRESS: "${factoryAddress}"
  ROUTER_ADDRESS: "${routerAddress}"
  PAIR_ADDRESS: "${pairAddress}"
  `);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
