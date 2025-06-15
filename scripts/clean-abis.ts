import fs from 'fs';
import path from 'path';

const cleanAbis = (): void => {
  console.log('🧹 Cleaning old ABI files...');

  const frontendAbiDir = path.join(__dirname, '..', 'frontend', 'src', 'contracts', 'abis');
  
  if (fs.existsSync(frontendAbiDir)) {
    const files = fs.readdirSync(frontendAbiDir);
    
    files.forEach(file => {
      if (file.endsWith('.json')) {
        const filePath = path.join(frontendAbiDir, file);
        fs.unlinkSync(filePath);
        console.log(`🗑️ Removed ${file}`);
      }
    });
    
    console.log('✅ Cleaned all old ABI files');
  } else {
    console.log('📁 ABI directory does not exist, nothing to clean');
  }
};

cleanAbis();
