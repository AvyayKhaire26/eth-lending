import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  // Get current network information
  const networkName = network.name;
  console.log(`Starting deployment on network: ${networkName}...`);
  
  // Get deployment accounts
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying with account: ${deployer.address}`);
  
  // Deploy token contracts
  console.log("\nDeploying token contracts...");
  
  const StableLoanToken = await ethers.getContractFactory("StableLoanToken");
  const stableLoanToken = await StableLoanToken.deploy();
  await stableLoanToken.waitForDeployment();
  console.log(`StableLoanToken deployed to: ${await stableLoanToken.getAddress()}`);
  
  const StandardLoanToken = await ethers.getContractFactory("StandardLoanToken");
  const standardLoanToken = await StandardLoanToken.deploy();
  await standardLoanToken.waitForDeployment();
  console.log(`StandardLoanToken deployed to: ${await standardLoanToken.getAddress()}`);
  
  const PremiumLoanToken = await ethers.getContractFactory("PremiumLoanToken");
  const premiumLoanToken = await PremiumLoanToken.deploy();
  await premiumLoanToken.waitForDeployment();
  console.log(`PremiumLoanToken deployed to: ${await premiumLoanToken.getAddress()}`);
  
  const MegaLoanToken = await ethers.getContractFactory("MegaLoanToken");
  const megaLoanToken = await MegaLoanToken.deploy();
  await megaLoanToken.waitForDeployment();
  console.log(`MegaLoanToken deployed to: ${await megaLoanToken.getAddress()}`);
  
  // Deploy LendingBank
  console.log("\nDeploying LendingBank contract...");
  const LendingBank = await ethers.getContractFactory("LendingBank");
  const lendingBank = await LendingBank.deploy();
  await lendingBank.waitForDeployment();
  const bankAddress = await lendingBank.getAddress();
  console.log(`LendingBank deployed to: ${bankAddress}`);
  
  // Add tokens to LendingBank
  console.log("\nAdding tokens to LendingBank...");
  await lendingBank.addSupportedToken(await stableLoanToken.getAddress());
  await lendingBank.addSupportedToken(await standardLoanToken.getAddress());
  await lendingBank.addSupportedToken(await premiumLoanToken.getAddress());
  await lendingBank.addSupportedToken(await megaLoanToken.getAddress());
  console.log("All tokens added to LendingBank");
  
  // Transfer token ownership to LendingBank
  console.log("\nTransferring token ownership to LendingBank...");
  await stableLoanToken.transferOwnership(bankAddress);
  await standardLoanToken.transferOwnership(bankAddress);
  await premiumLoanToken.transferOwnership(bankAddress);
  await megaLoanToken.transferOwnership(bankAddress);
  console.log("All token ownership transferred to LendingBank");
  
  // Enable test mode and initialize token reserves only on development networks
  if (networkName === "localhost" || networkName === "hardhat") {
    console.log("\nEnabling test mode for development...");
    await lendingBank.setTestMode(true);
    console.log("Test mode enabled");
    
    console.log("\nInitializing token reserves...");
    await lendingBank.initializeTokenReserves(ethers.parseUnits("1000000", 18));
    console.log("Token reserves initialized");
  }
  
  // Save deployment information
  const deploymentInfo = {
    network: networkName,
    stableLoanToken: await stableLoanToken.getAddress(),
    standardLoanToken: await standardLoanToken.getAddress(),
    premiumLoanToken: await premiumLoanToken.getAddress(),
    megaLoanToken: await megaLoanToken.getAddress(),
    lendingBank: bankAddress,
    deployer: deployer.address,
    timestamp: new Date().toISOString()
  };
  
  // Create deployment directory if it doesn't exist
  if (!fs.existsSync("./deployments")) {
    fs.mkdirSync("./deployments");
  }
  
  // Write deployment information to network-specific file
  const deploymentPath = `./deployments/${networkName}-deployment.json`;
  fs.writeFileSync(
    deploymentPath,
    JSON.stringify(deploymentInfo, null, 2)
  );  
  
  console.log("\nDeployment complete!");
  console.log(`Deployment information saved to ${deploymentPath}`);
}

// We recommend this pattern to be able to use async/await everywhere
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
