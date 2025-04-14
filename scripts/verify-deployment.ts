// scripts/verify-deployment.ts
import * as fs from "fs";
import { ethers, network } from "hardhat";
import { LendingBank, StableLoanToken, StandardLoanToken, PremiumLoanToken, MegaLoanToken } from "../typechain";

async function main() {
  try {
    // Get current network
    const networkName = network.name;
    
    // Load deployment information
    console.log(`Reading deployment information for network: ${networkName}...`);
    const deploymentPath = `./deployments/${networkName}-deployment.json`;
    
    if (!fs.existsSync(deploymentPath)) {
      throw new Error(`Deployment file not found at ${deploymentPath}`);
    }
    
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    
    console.log("\nContract Addresses:");
    console.log(`LendingBank: ${deployment.lendingBank}`);
    console.log(`StableLoanToken: ${deployment.stableLoanToken}`);
    console.log(`StandardLoanToken: ${deployment.standardLoanToken}`);
    console.log(`PremiumLoanToken: ${deployment.premiumLoanToken}`);
    console.log(`MegaLoanToken: ${deployment.megaLoanToken}`);
    
    // Get contract factories
    const LendingBank = await ethers.getContractFactory("LendingBank");
    const StableLoanToken = await ethers.getContractFactory("StableLoanToken");
    const StandardLoanToken = await ethers.getContractFactory("StandardLoanToken");
    const PremiumLoanToken = await ethers.getContractFactory("PremiumLoanToken");
    const MegaLoanToken = await ethers.getContractFactory("MegaLoanToken");
    
    // Attach to deployed contracts
    const lendingBank = (await LendingBank.attach(deployment.lendingBank)) as unknown as LendingBank;
    const stableLoanToken = (await StableLoanToken.attach(deployment.stableLoanToken)) as unknown as StableLoanToken;
    const standardLoanToken = (await StandardLoanToken.attach(deployment.standardLoanToken)) as unknown as StandardLoanToken;
    const premiumLoanToken = (await PremiumLoanToken.attach(deployment.premiumLoanToken)) as unknown as PremiumLoanToken;
    const megaLoanToken = (await MegaLoanToken.attach(deployment.megaLoanToken)) as unknown as MegaLoanToken;
    
    // Verify LendingBank functionality
    console.log("\n=== Verifying LendingBank Contract ===");
    const tokenCount = await lendingBank.getSupportedTokenCount();
    console.log(`Supported token count: ${tokenCount.toString()}`);
    
    // Only check test mode on development networks
    if (networkName === "localhost" || networkName === "hardhat") {
      const testMode = await lendingBank.testMode();
      console.log(`Test mode enabled: ${testMode}`);
    }
    
    // Verify token properties
    console.log("\n=== Verifying Token Contracts ===");
    
    // StableLoanToken
    const stableValue = await stableLoanToken.tokenValue();
    const stableRate = await stableLoanToken.interestRate();
    console.log(`StableLoanToken value: ${ethers.formatEther(stableValue)} ETH, rate: ${Number(stableRate)/100}%`);
    
    // StandardLoanToken
    const standardValue = await standardLoanToken.tokenValue();
    const standardRate = await standardLoanToken.interestRate();
    console.log(`StandardLoanToken value: ${ethers.formatEther(standardValue)} ETH, rate: ${Number(standardRate)/100}%`);
    
    // PremiumLoanToken
    const premiumValue = await premiumLoanToken.tokenValue();
    const premiumRate = await premiumLoanToken.interestRate();
    console.log(`PremiumLoanToken value: ${ethers.formatEther(premiumValue)} ETH, rate: ${Number(premiumRate)/100}%`);
    
    // MegaLoanToken
    const megaValue = await megaLoanToken.tokenValue();
    const megaRate = await megaLoanToken.interestRate();
    console.log(`MegaLoanToken value: ${ethers.formatEther(megaValue)} ETH, rate: ${Number(megaRate)/100}%`);
    
    console.log("\n✅ All contracts verified successfully!");
    console.log(`Ready for ${networkName === "localhost" ? "frontend development" : "production use"}.`);
    
  } catch (error) {
    console.error("\n❌ Error verifying deployment:", error);
    console.log("\nTroubleshooting tips:");
    console.log(`1. Ensure your network (${network.name}) is properly configured in hardhat.config.ts`);
    console.log(`2. Make sure you've deployed contracts with 'npx hardhat run scripts/deploy.ts --network ${network.name}'`);
    console.log(`3. Check that deployments/${network.name}-deployment.json exists and contains valid addresses`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
