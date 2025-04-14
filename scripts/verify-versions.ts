import { ethers } from "ethers";

async function main() {
  console.log("Checking environment configuration:");
  console.log(`- Ethers version: ${ethers.version}`);
  console.log(`- Node.js version: ${process.version}`);
  
  // Verify package.json dependencies
  const packageJson = require('../package.json');
  console.log("Dependencies:");
  console.log(`- @openzeppelin/contracts: ${packageJson.devDependencies["@openzeppelin/contracts"]}`);
  console.log(`- hardhat: ${packageJson.devDependencies.hardhat}`);

  console.log("\nEnvironment setup complete! ✅");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
