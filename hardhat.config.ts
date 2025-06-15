import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import "@typechain/hardhat";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Get API keys and private keys from environment
const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000000";
const INFURA_API_KEY = process.env.INFURA_API_KEY || "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: true  // Keep this - it helps with contract size
      // ✅ Removed problematic evmVersion
    }
  },
  networks: {
    hardhat: {
      chainId: 31337,
      allowUnlimitedContractSize: true,
      blockGasLimit: 30000000,      // ✅ Reduced to safe limit
      gas: "auto",                  // ✅ Keep auto-calculation
      gasPrice: "auto"              // ✅ Keep auto-calculation
      // ✅ Removed problematic initialBaseFeePerGas and excessive account config
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
      gas: "auto",
      gasPrice: "auto",
      timeout: 60000
    }
  },
  typechain: {
    outDir: "typechain",
    target: "ethers-v6"
  },
  mocha: {
    timeout: 60000
  }
};

export default config;
