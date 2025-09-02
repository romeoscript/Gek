import cloudinary from 'cloudinary';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure Cloudinary (use the same credentials as your upload script)
cloudinary.v2.config({
  cloud_name: 'dxt4avubv', // Replace with your cloud name
  api_key: '811677793416199',       // Replace with your API key
  api_secret: 'gCGAuApl_VhLq1VdpsFJbRq94Lk'  // Replace with your API secret
});

// Function to get all resources in a specific folder
async function getFolderContents(folderPath) {
  try {
    console.log(`📁 Fetching contents of folder: ${folderPath}`);
    
    const result = await cloudinary.v2.api.resources({
      type: 'upload',
      prefix: folderPath,
      max_results: 500, // Adjust based on your needs
      resource_type: 'image'
    });
    
    return result.resources || [];
  } catch (error) {
    console.error(`❌ Error fetching folder ${folderPath}:`, error.message);
    return [];
  }
}

// Function to analyze animation sequence and extract metadata
function analyzeSequence(files, folderName) {
  if (files.length === 0) return null;
  
  // Sort files by name to maintain frame order
  const sortedFiles = files.sort((a, b) => a.public_id.localeCompare(b.public_id));
  
  // Extract frame numbers and patterns
  const firstFile = sortedFiles[0];
  const lastFile = sortedFiles[sortedFiles.length - 1];
  
  // Try to extract frame number from filename
  const frameMatch = firstFile.public_id.match(/(\d+)\.webp$/);
  const startFrame = frameMatch ? parseInt(frameMatch[1]) : 0;
  
  // Determine if it's a loop based on folder name
  const isLoop = folderName.includes('loop') || folderName === 'background';
  
  // Generate the pattern based on the actual filename format
  const fileName = path.basename(firstFile.public_id);
  const patternMatch = fileName.match(/(.*?)(\d+)\.webp$/);
  let pattern = '';
  
  if (patternMatch) {
    const baseName = patternMatch[1];
    const digits = patternMatch[2].length;
    pattern = `${baseName}%0${digits}d.webp`;
  } else {
    pattern = `%05d.webp`; // Default pattern
  }
  
  return {
    path: `https://res.cloudinary.com/${cloudinary.v2.config().cloud_name}/image/upload/f_auto,q_auto/${folderName}/`,
    start: startFrame,
    end: startFrame + sortedFiles.length - 1,
    pad: 5,
    pattern: pattern,
    loop: isLoop,
    fileCount: sortedFiles.length
  };
}

// Function to get all folders and their contents
async function getAllFolders() {
  console.log('🔍 Fetching all folders from Cloudinary...\n');
  
  try {
    // Get all resources with the gek-animations prefix (handle pagination)
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
    
    const result = { resources: allResources };
    
    if (!result.resources || result.resources.length === 0) {
      console.log('❌ No resources found in gek-animations folder');
      return {};
    }
    
    // Group files by folder
    const folders = {};
    
    result.resources.forEach(resource => {
      // Extract folder name from public_id
      const pathParts = resource.public_id.split('/');
      if (pathParts.length >= 2) {
        const folderName = pathParts[1]; // gek-animations/folderName/filename
        if (!folders[folderName]) {
          folders[folderName] = [];
        }
        folders[folderName].push(resource);
      }
    });
    
    return folders;
    
  } catch (error) {
    console.error('❌ Error fetching resources:', error.message);
    return {};
  }
}

// Function to generate updated manifest
function generateManifest(folders) {
  const cloudName = cloudinary.v2.config().cloud_name;
  
  const manifest = {
    fps: 24,
    cloudinary: {
      cloud_name: cloudName,
      base_url: `https://res.cloudinary.com/${cloudName}/image/upload`,
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
    const sequenceData = analyzeSequence(folders[folderName], `gek-animations/${folderName}`);
    
    if (sequenceData) {
      manifest.sequences[sequenceName] = sequenceData;
      console.log(`✅ ${sequenceName}: ${sequenceData.fileCount} files (frames ${sequenceData.start}-${sequenceData.end})`);
    }
  });
  
  return manifest;
}

// Main function
async function getCloudinaryFolders() {
  console.log('🚀 Getting Cloudinary folders and files...\n');
  
  try {
    // Get all folders and their contents
    const folders = await getAllFolders();
    
    if (Object.keys(folders).length === 0) {
      console.log('❌ No folders found. Make sure you have uploaded files to Cloudinary first.');
      return;
    }
    
    console.log(`\n📊 Found ${Object.keys(folders).length} folders:`);
    Object.keys(folders).forEach(folder => {
      console.log(`   - ${folder}: ${folders[folder].length} files`);
    });
    
    // Generate updated manifest
    console.log('\n📝 Generating updated manifest...');
    const manifest = generateManifest(folders);
    
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
    
    console.log('\n🎉 Success! Your manifest is now updated with the correct Cloudinary URLs.');
    console.log('You can now use this manifest in your application to load animations from Cloudinary.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Check if credentials are set
if (cloudinary.v2.config().cloud_name === 'YOUR_CLOUD_NAME') {
  console.log('❌ Please configure your Cloudinary credentials first!');
  console.log('\n1. Update the cloudinary.config() in this script');
  console.log('2. Or set environment variables:');
  console.log('   CLOUDINARY_CLOUD_NAME=your_cloud_name');
  console.log('   CLOUDINARY_API_KEY=your_api_key');
  console.log('   CLOUDINARY_API_SECRET=your_api_secret');
} else {
  getCloudinaryFolders().catch(console.error);
}
