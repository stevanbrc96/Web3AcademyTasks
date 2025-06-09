require("@nomicfoundation/hardhat-toolbox");

require('dotenv').config();


module.exports = {
  solidity: {
    version: "0.8.20", 
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true, 
    },
  },
  networks: {
    hardhat: { 
    },
    localhost: {
      url: "http://127.0.0.1:8545", 
    },
    
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },
};