import fs from 'fs';
import path from 'path';

const cleanAllData = (): void => {
  console.log('🧹 Starting complete cleanup...');

  // 1. Clean frontend ABIs
  const frontendAbiDir = path.join(__dirname, '..', 'frontend', 'src', 'contracts', 'abis');
  if (fs.existsSync(frontendAbiDir)) {
    fs.rmSync(frontendAbiDir, { recursive: true, force: true });
    console.log('🗑️ Deleted frontend ABI directory');
  }

  // 2. Clean frontend contract addresses
  const frontendContractsDir = path.join(__dirname, '..', 'frontend', 'src', 'contracts');
  const addressesFile = path.join(frontendContractsDir, 'addresses.json');
  if (fs.existsSync(addressesFile)) {
    fs.unlinkSync(addressesFile);
    console.log('🗑️ Deleted contract addresses file');
  }

  // 3. Clean backend artifacts
  const artifactsDir = path.join(__dirname, '..', 'artifacts');
  if (fs.existsSync(artifactsDir)) {
    fs.rmSync(artifactsDir, { recursive: true, force: true });
    console.log('🗑️ Deleted artifacts directory');
  }

  // 4. Clean deployments
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  if (fs.existsSync(deploymentsDir)) {
    fs.rmSync(deploymentsDir, { recursive: true, force: true });
    console.log('🗑️ Deleted deployments directory');
  }

  // 5. Clean cache
  const cacheDir = path.join(__dirname, '..', 'cache');
  if (fs.existsSync(cacheDir)) {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    console.log('🗑️ Deleted cache directory');
  }

  console.log('✅ Complete cleanup finished!');
};

cleanAllData();
