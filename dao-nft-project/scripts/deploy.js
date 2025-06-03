const hre = require("hardhat");

async function main() {
  // Uzimamo deployer (prvi signer iz liste)
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with:", deployer.address);

  // IPFS hash za NFT metapodatke (ovde se može menjati kasnije)
  const tokenURI = "ipfs://bafkreie2npltua7ivmcvtqa5g53osir3rbht37ibsdj7bysbvnirwtfchi";

  // Deploy-ujemo DAO ugovor koji u konstrukturu deploy-uje i NFT ugovor
  // I automatski mintuje prvi NFT (mint cena: 0.01 ETH)
  const DAO = await hre.ethers.getContractFactory("DAO");
  const dao = await DAO.deploy(tokenURI, { value: hre.ethers.utils.parseEther("0.01") });

  // Čekamo da se deploy završi
  await dao.deployed();

  // Štampamo adresu deploy-ovanog DAO ugovora
  console.log("DAO deployed to:", dao.address);

  // Dohvatamo adresu NFT ugovora koji je deploy-ovao DAO
  const membershipNFTAddress = await dao.membershipNFT();
  console.log("MembershipNFT deployed to:", membershipNFTAddress);
}

// Standardno pokretanje
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
