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

// Function to get all resources with their actual URLs
async function getAllResources() {
  console.log('🔍 Fetching all resources from Cloudinary...\n');
  
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
  
  return allResources;
}

// Function to group files by folder and sort them
function groupAndSortFiles(resources) {
  const folders = {};
  
  resources.forEach(resource => {
    const pathParts = resource.public_id.split('/');
    if (pathParts.length >= 2) {
      const folderName = pathParts[1]; // gek-animations/folderName/filename
      if (!folders[folderName]) {
        folders[folderName] = [];
      }
      folders[folderName].push(resource);
    }
  });
  
  // Sort files within each folder by their original filename or creation date
  Object.keys(folders).forEach(folderName => {
    folders[folderName].sort((a, b) => {
      // Try to extract frame number from filename
      const aMatch = a.public_id.match(/(\d+)$/);
      const bMatch = b.public_id.match(/(\d+)$/);
      
      if (aMatch && bMatch) {
        return parseInt(aMatch[1]) - parseInt(bMatch[1]);
      }
      
      // Fallback to creation date
      return new Date(a.created_at) - new Date(b.created_at);
    });
  });
  
  return folders;
}

// Function to generate manifest with actual URLs
function generateManifestWithUrls(folders) {
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
      // Generate URLs for each frame
      const frameUrls = files.map(file => file.secure_url);
      
      // Determine if it's a loop based on folder name
      const isLoop = folderName.includes('loop') || folderName === 'background';
      
      manifest.sequences[sequenceName] = {
        frames: frameUrls,
        start: 0,
        end: files.length - 1,
        loop: isLoop,
        fileCount: files.length
      };
      
      console.log(`✅ ${sequenceName}: ${files.length} files (frames 0-${files.length - 1})`);
    }
  });
  
  return manifest;
}

// Main function
async function fixCloudinaryUrls() {
  console.log('🚀 Fixing Cloudinary URLs...\n');
  
  try {
    // Get all resources
    const resources = await getAllResources();
    
    if (resources.length === 0) {
      console.log('❌ No resources found. Make sure you have uploaded files to Cloudinary first.');
      return;
    }
    
    console.log(`\n📊 Found ${resources.length} total files`);
    
    // Group and sort files
    const folders = groupAndSortFiles(resources);
    
    console.log(`\n📁 Found ${Object.keys(folders).length} folders:`);
    Object.keys(folders).forEach(folder => {
      console.log(`   - ${folder}: ${folders[folder].length} files`);
    });
    
    // Generate manifest with actual URLs
    console.log('\n📝 Generating manifest with actual URLs...');
    const manifest = generateManifestWithUrls(folders);
    
    // Save the updated manifest
    const manifestPath = path.join(__dirname, 'public', 'animations', 'manifest-cloudinary.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    
    console.log(`\n✅ Updated manifest saved to: ${manifestPath}`);
    console.log('\n📋 Manifest summary:');
    console.log(`   Cloud name: ${manifest.cloudinary.cloud_name}`);
    console.log(`   Sequences: ${Object.keys(manifest.sequences).length}`);
    Object.keys(manifest.sequences).forEach(seq => {
      const data = manifest.sequences[seq];
      console.log(`   - ${seq}: ${data.fileCount} files, ${data.loop ? 'looping' : 'non-looping'}`);
    });
    
    // Test a few URLs
    console.log('\n🧪 Testing URLs...');
    Object.keys(manifest.sequences).forEach(seq => {
      const data = manifest.sequences[seq];
      if (data.frames && data.frames.length > 0) {
        console.log(`   ${seq} - First frame: ${data.frames[0]}`);
      }
    });
    
    console.log('\n🎉 Success! Your manifest now contains the actual Cloudinary URLs.');
    console.log('The URLs should work correctly in your browser now.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Check if credentials are set
if (cloudinary.v2.config().cloud_name === 'YOUR_CLOUD_NAME') {
  console.log('❌ Please configure your Cloudinary credentials first!');
} else {
  fixCloudinaryUrls().catch(console.error);
}
