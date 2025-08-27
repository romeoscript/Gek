import cloudinary from 'cloudinary';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure Cloudinary
cloudinary.v2.config({
  cloud_name: 'dxt4avubv',
  api_key: '811677793416199',
  api_secret: 'gCGAuApl_VhLq1VdpsFJbRq94Lk'
});

// Function to create optimized manifest with better loading strategy
async function createOptimizedManifest() {
  console.log('🚀 Creating optimized manifest for efficient loading...\n');
  
  // Get all resources
  let allResources = [];
  let nextCursor = null;
  
  do {
    const options = {
      type: 'upload',
      prefix: 'gek-animations/',
      max_results: 500,
      resource_type: 'image'
    };
    
    if (nextCursor) {
      options.next_cursor = nextCursor;
    }
    
    const result = await cloudinary.v2.api.resources(options);
    
    if (result.resources) {
      allResources = allResources.concat(result.resources);
    }
    
    nextCursor = result.next_cursor;
    console.log(`📥 Fetched ${result.resources ? result.resources.length : 0} files...`);
    
  } while (nextCursor);
  
  // Group files by folder
  const folders = {};
  
  allResources.forEach(resource => {
    const pathParts = resource.public_id.split('/');
    if (pathParts.length >= 2) {
      const folderName = pathParts[1];
      if (!folders[folderName]) {
        folders[folderName] = [];
      }
      folders[folderName].push(resource);
    }
  });
  
  // Sort files within each folder by creation date
  Object.keys(folders).forEach(folderName => {
    folders[folderName].sort((a, b) => 
      new Date(a.created_at) - new Date(b.created_at)
    );
  });
  
  // Create optimized manifest
  const cloudName = cloudinary.v2.config().cloud_name;
  
  const manifest = {
    fps: 24,
    cloudinary: {
      cloud_name: cloudName,
      transformations: "f_auto,q_auto"
    },
    sequences: {}
  };
  
  // Map folder names to sequence names
  const folderMapping = {
    'idle-loop': 'idle',
    'sleep-cycle': 'sleep',
    'sleep-transition-loop': 'sleepTransition',
    'waking-up-loop': 'wake',
    'background': 'background'
  };
  
  Object.keys(folders).forEach(folderName => {
    const sequenceName = folderMapping[folderName] || folderName;
    const files = folders[folderName];
    
    if (files.length > 0) {
      // Create optimized URLs with better transformations
      const frameUrls = files.map(file => {
        // Add transformations for better performance
        return file.secure_url.replace('/upload/', '/upload/f_auto,q_auto,fl_progressive/');
      });
      
      const isLoop = folderName.includes('loop') || folderName === 'background';
      
      manifest.sequences[sequenceName] = {
        frames: frameUrls,
        start: 0,
        end: files.length - 1,
        loop: isLoop,
        fileCount: files.length,
        // Add loading strategy
        loadingStrategy: 'lazy',
        preloadFrames: 5,
        batchSize: 3
      };
      
      console.log(`✅ ${sequenceName}: ${files.length} files (frames 0-${files.length - 1})`);
    }
  });
  
  // Save optimized manifest
  const manifestPath = path.join(__dirname, 'public', 'animations', 'manifest-optimized.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  
  console.log(`\n✅ Optimized manifest saved to: ${manifestPath}`);
  console.log('\n📋 Optimization features:');
  console.log('   - Progressive JPEG loading (fl_progressive)');
  console.log('   - Automatic format selection (f_auto)');
  console.log('   - Automatic quality optimization (q_auto)');
  console.log('   - Lazy loading strategy');
  console.log('   - Reduced preload frames (5 instead of 10)');
  console.log('   - Smaller batch sizes (3 instead of larger batches)');
  
  return manifest;
}

// Function to create a lightweight manifest for testing
function createLightweightManifest() {
  console.log('🪶 Creating lightweight manifest for testing...\n');
  
  const cloudName = cloudinary.v2.config().cloud_name;
  
  const manifest = {
    fps: 24,
    cloudinary: {
      cloud_name: cloudName,
      transformations: "f_auto,q_auto"
    },
    sequences: {
      background: {
        frames: [
          `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto,fl_progressive/gek-animations/background/aus9o525hrmqiwfo0k1d.webp`,
          `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto,fl_progressive/gek-animations/background/g2zvvnd1epvh0km8ytb0.webp`,
          `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto,fl_progressive/gek-animations/background/szpc5oaiyhidjaqtgx1e.webp`
        ],
        start: 0,
        end: 2,
        loop: true,
        fileCount: 3,
        loadingStrategy: 'test'
      },
      idle: {
        frames: [
          `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto,fl_progressive/gek-animations/idle-loop/nvbklpl4j7gkcmgsfghl.webp`,
          `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto,fl_progressive/gek-animations/idle-loop/aapbgt0f4pfqtkoyfd7j.webp`,
          `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto,fl_progressive/gek-animations/idle-loop/ac5hpomyj56zvucwhieq.webp`
        ],
        start: 0,
        end: 2,
        loop: true,
        fileCount: 3,
        loadingStrategy: 'test'
      }
    }
  };
  
  const manifestPath = path.join(__dirname, 'public', 'animations', 'manifest-test.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  
  console.log(`✅ Test manifest saved to: ${manifestPath}`);
  console.log('This manifest only includes 3 frames per sequence for testing.');
  
  return manifest;
}

// Main function
async function optimizeLoading() {
  console.log('🎯 Optimizing image loading strategies...\n');
  
  try {
    // Create both manifests
    await createOptimizedManifest();
    createLightweightManifest();
    
    console.log('\n🎉 Optimization complete!');
    console.log('\n💡 Usage options:');
    console.log('1. Use manifest-optimized.json for full sequences with better loading');
    console.log('2. Use manifest-test.json for quick testing with fewer frames');
    console.log('3. The optimized manifest includes progressive loading and better caching');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Check if credentials are set
if (cloudinary.v2.config().cloud_name === 'YOUR_CLOUD_NAME') {
  console.log('❌ Please configure your Cloudinary credentials first!');
} else {
  optimizeLoading().catch(console.error);
}
