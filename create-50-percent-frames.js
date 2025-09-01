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

// Function to create 50% frame manifest
async function create50PercentFrameManifest() {
  console.log('🚀 Creating 50% frame manifest for optimal performance...\n');
  
  // Get all resources
  let allResources = [];
  let nextCursor = null;
  
  do {
    const options = {
      type: 'upload',
      prefix: 'gek-animations-mobile/',
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
  
  // Create 50% frame manifest
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
      // Calculate 50% of frames
      const targetFrameCount = Math.round(files.length * 0.5);
      
      // Calculate step to get approximately 50% of frames
      const step = Math.max(1, Math.round(files.length / targetFrameCount));
      
      // Select frames to get close to 50%
      const selectedFrames = [];
      for (let i = 0; i < files.length; i += step) {
        if (selectedFrames.length < targetFrameCount) {
          const file = files[i];
          const optimizedUrl = file.secure_url.replace('/upload/', '/upload/f_auto,q_auto,fl_progressive/');
          selectedFrames.push(optimizedUrl);
        }
      }
      
      // If we have fewer frames than 50%, add some more
      if (selectedFrames.length < targetFrameCount) {
        const remainingFrames = targetFrameCount - selectedFrames.length;
        const additionalStep = Math.max(1, Math.floor(files.length / remainingFrames));
        
        for (let i = 0; i < files.length && selectedFrames.length < targetFrameCount; i += additionalStep) {
          if (!selectedFrames.includes(files[i].secure_url.replace('/upload/', '/upload/f_auto,q_auto,fl_progressive/'))) {
            const file = files[i];
            const optimizedUrl = file.secure_url.replace('/upload/', '/upload/f_auto,q_auto,fl_progressive/');
            selectedFrames.push(optimizedUrl);
          }
        }
      }
      
      const isLoop = folderName.includes('loop') || folderName === 'background';
      
      manifest.sequences[sequenceName] = {
        frames: selectedFrames,
        start: 0,
        end: selectedFrames.length - 1,
        loop: isLoop,
        fileCount: selectedFrames.length,
        originalFrameCount: files.length,
        percentage: Math.round((selectedFrames.length / files.length) * 100)
      };
      
      console.log(`✅ ${sequenceName}: ${selectedFrames.length}/${files.length} frames (${Math.round((selectedFrames.length / files.length) * 100)}%)`);
    }
  });
  
  // Save 50% manifest
  const manifestPath = path.join(__dirname, 'public', 'animations', 'manifest-50percent.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  
  const totalFrames = Object.values(manifest.sequences).reduce((sum, seq) => sum + seq.fileCount, 0);
  const originalFrames = Object.values(manifest.sequences).reduce((sum, seq) => sum + seq.originalFrameCount, 0);
  
  console.log(`\n✅ 50% manifest saved to: ${manifestPath}`);
  console.log('\n📊 Frame summary:');
  console.log(`   Original frames: ${originalFrames}`);
  console.log(`   50% frames: ${totalFrames}`);
  console.log(`   Percentage: ${Math.round((totalFrames / originalFrames) * 100)}%`);
  console.log(`   Requests saved: ${originalFrames - totalFrames}`);
  
  return manifest;
}

// Check if credentials are set
if (cloudinary.v2.config().cloud_name === 'YOUR_CLOUD_NAME') {
  console.log('❌ Please configure your Cloudinary credentials first!');
} else {
  create50PercentFrameManifest().catch(console.error);
}
