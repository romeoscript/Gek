const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Check if cwebp is installed
function checkCwebp() {
    try {
        execSync('cwebp -version', { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

// Optimize WebP files
function optimizeWebpFiles(directory) {
    const files = fs.readdirSync(directory);
    
    files.forEach(file => {
        if (file.endsWith('.webp')) {
            const filePath = path.join(directory, file);
            const stats = fs.statSync(filePath);
            
            // Only optimize if file is larger than 100KB
            if (stats.size > 100 * 1024) {
                console.log(`Optimizing ${file}...`);
                try {
                    // Create optimized version with better compression
                    execSync(`cwebp -q 80 -m 6 -af -f 50 -sharpness 0 -mt -v "${filePath}" -o "${filePath}.tmp"`);
                    
                    // Replace original with optimized version
                    fs.renameSync(`${filePath}.tmp`, filePath);
                    
                    const newStats = fs.statSync(filePath);
                    const savings = ((stats.size - newStats.size) / stats.size * 100).toFixed(1);
                    console.log(`  Reduced by ${savings}% (${(stats.size / 1024).toFixed(0)}KB → ${(newStats.size / 1024).toFixed(0)}KB)`);
                } catch (error) {
                    console.error(`  Failed to optimize ${file}:`, error.message);
                }
            }
        }
    });
}

// Main execution
console.log('WebP Optimization Script');
console.log('=======================');

if (!checkCwebp()) {
    console.log('❌ cwebp not found. Please install it first:');
    console.log('   macOS: brew install webp');
    console.log('   Ubuntu: sudo apt-get install webp');
    console.log('   Windows: Download from https://developers.google.com/speed/webp/');
    process.exit(1);
}

console.log('✅ cwebp found. Starting optimization...\n');

const animationsDir = path.join(__dirname, 'public', 'animations');
const subdirs = fs.readdirSync(animationsDir).filter(dir => 
    fs.statSync(path.join(animationsDir, dir)).isDirectory()
);

subdirs.forEach(subdir => {
    const subdirPath = path.join(animationsDir, subdir);
    console.log(`\n📁 Processing ${subdir}...`);
    optimizeWebpFiles(subdirPath);
});

console.log('\n✅ Optimization complete!');
console.log('\nExpected improvements:');
console.log('- 30-50% file size reduction');
console.log('- Faster loading times');
console.log('- Better compression');
