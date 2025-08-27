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

// Function to create reduced frame manifest
async function createReducedFrameManifest() {
  console.log('🚀 Creating reduced frame manifest to minimize Cloudinary requests...\n');
  
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
  
  // Create reduced manifest with fewer frames
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
      // Reduce frame count based on sequence type
      let frameStep = 1;
      let maxFrames = 30; // Maximum frames per sequence
      
      if (sequenceName === 'background') {
        frameStep = 6; // Every 6th frame for background (192 -> 32 frames)
        maxFrames = 32;
      } else if (sequenceName === 'idle') {
        frameStep = 6; // Every 6th frame for idle (192 -> 32 frames)
        maxFrames = 32;
      } else if (sequenceName === 'sleep') {
        frameStep = 6; // Every 6th frame for sleep (193 -> 32 frames)
        maxFrames = 32;
      } else if (sequenceName === 'sleepTransition') {
        frameStep = 2; // Every 2nd frame for transitions (73 -> 36 frames)
        maxFrames = 36;
      } else if (sequenceName === 'wake') {
        frameStep = 2; // Every 2nd frame for wake (74 -> 37 frames)
        maxFrames = 37;
      }
      
      // Select reduced frames
      const reducedFrames = [];
      for (let i = 0; i < files.length && reducedFrames.length < maxFrames; i += frameStep) {
        const file = files[i];
        const optimizedUrl = file.secure_url.replace('/upload/', '/upload/f_auto,q_auto,fl_progressive/');
        reducedFrames.push(optimizedUrl);
      }
      
      const isLoop = folderName.includes('loop') || folderName === 'background';
      
      manifest.sequences[sequenceName] = {
        frames: reducedFrames,
        start: 0,
        end: reducedFrames.length - 1,
        loop: isLoop,
        fileCount: reducedFrames.length,
        originalFrameCount: files.length,
        frameStep: frameStep
      };
      
      console.log(`✅ ${sequenceName}: ${reducedFrames.length}/${files.length} frames (step: ${frameStep})`);
    }
  });
  
  // Save reduced manifest
  const manifestPath = path.join(__dirname, 'public', 'animations', 'manifest-reduced.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  
  const totalFrames = Object.values(manifest.sequences).reduce((sum, seq) => sum + seq.fileCount, 0);
  const originalFrames = Object.values(manifest.sequences).reduce((sum, seq) => sum + seq.originalFrameCount, 0);
  
  console.log(`\n✅ Reduced manifest saved to: ${manifestPath}`);
  console.log('\n📊 Frame reduction summary:');
  console.log(`   Original frames: ${originalFrames}`);
  console.log(`   Reduced frames: ${totalFrames}`);
  console.log(`   Reduction: ${Math.round((1 - totalFrames / originalFrames) * 100)}%`);
  console.log(`   Requests saved: ${originalFrames - totalFrames}`);
  
  return manifest;
}

// Check if credentials are set
if (cloudinary.v2.config().cloud_name === 'YOUR_CLOUD_NAME') {
  console.log('❌ Please configure your Cloudinary credentials first!');
} else {
  createReducedFrameManifest().catch(console.error);
}
