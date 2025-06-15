import fs from 'fs';
import path from 'path';
import glob from 'glob'; // ✅ Fixed import

interface ContractArtifact {
  abi: any[];
  contractName: string;
  sourceName: string;
}

const copyAbis = async (): Promise<void> => {
  console.log('🔄 Starting ABI copy process...');

  // Define paths
  const artifactsDir = path.join(__dirname, '..', 'artifacts', 'contracts');
  const frontendAbiDir = path.join(__dirname, '..', 'frontend', 'src', 'contracts', 'abis');
  
  // Create frontend ABI directory if it doesn't exist
  if (!fs.existsSync(frontendAbiDir)) {
    fs.mkdirSync(frontendAbiDir, { recursive: true });
    console.log('📁 Created frontend ABI directory');
  }

  try {
    // Find all contract JSON files - ✅ Fixed glob usage
    const artifactPattern = path.join(artifactsDir, '**/*.json');
    const artifactFiles = glob.sync(artifactPattern); // Use sync method
    
    let copiedCount = 0;

    for (const artifactFile of artifactFiles) {
      // Skip debug files
      if (artifactFile.includes('.dbg.json')) {
        continue;
      }

      // Read the artifact
      const artifactContent = fs.readFileSync(artifactFile, 'utf8');
      const artifact: ContractArtifact = JSON.parse(artifactContent);

      // Extract contract name from file path
      const fileName = path.basename(artifactFile);
      const contractName = fileName.replace('.json', '');

      // Skip if no ABI
      if (!artifact.abi || artifact.abi.length === 0) {
        continue;
      }

      // Copy ABI to frontend
      const destFile = path.join(frontendAbiDir, fileName);
      
      // Create a clean ABI-only file
      const abiContent = {
        contractName: contractName,
        abi: artifact.abi,
        sourceName: artifact.sourceName || contractName,
        timestamp: new Date().toISOString()
      };

      fs.writeFileSync(destFile, JSON.stringify(abiContent, null, 2));
      console.log(`✅ Copied ${contractName} ABI to frontend`);
      copiedCount++;
    }

    console.log(`🎉 Successfully copied ${copiedCount} ABI files to frontend`);

    // Update contract addresses file
    await updateContractAddresses();

  } catch (error) {
    console.error('❌ Error copying ABIs:', error);
    process.exit(1);
  }
};

const updateContractAddresses = async (): Promise<void> => {
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  const frontendContractsDir = path.join(__dirname, '..', 'frontend', 'src', 'contracts');
  
  if (fs.existsSync(deploymentsDir)) {
    const deploymentFile = path.join(deploymentsDir, 'localhost-deployment.json');
    
    if (fs.existsSync(deploymentFile)) {
      const deploymentData = fs.readFileSync(deploymentFile, 'utf8');
      const addressesFile = path.join(frontendContractsDir, 'addresses.json');
      
      fs.writeFileSync(addressesFile, deploymentData);
      console.log('📍 Updated contract addresses in frontend');
    }
  }
};

// Run the script
copyAbis().catch(error => {
  console.error('Failed to copy ABIs:', error);
  process.exit(1);
});
