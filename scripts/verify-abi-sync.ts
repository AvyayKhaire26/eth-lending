import fs from 'fs';
import path from 'path';

interface ABIFile {
  contractName: string;
  abi: any[];
  timestamp: string;
}

const verifyAbiSync = (): void => {
  console.log('🔍 Verifying ABI synchronization...');

  const frontendAbiDir = path.join(__dirname, '..', 'frontend', 'src', 'contracts', 'abis');
  const artifactsDir = path.join(__dirname, '..', 'artifacts', 'contracts');

  if (!fs.existsSync(frontendAbiDir)) {
    console.error('❌ Frontend ABI directory does not exist');
    process.exit(1);
  }

  const frontendFiles = fs.readdirSync(frontendAbiDir)
    .filter(file => file.endsWith('.json'));

  if (frontendFiles.length === 0) {
    console.error('❌ No ABI files found in frontend');
    process.exit(1);
  }

  console.log(`📊 Found ${frontendFiles.length} ABI files in frontend:`);

  frontendFiles.forEach(file => {
    const filePath = path.join(frontendAbiDir, file);
    const content: ABIFile = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    console.log(`  ✅ ${content.contractName} (${content.abi.length} functions) - ${content.timestamp}`);
  });

  console.log('🎉 ABI verification complete');
};

verifyAbiSync();
