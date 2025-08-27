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

// Function to create video from image sequence
async function createVideoFromSequence(folderName, sequenceName) {
  console.log(`🎬 Creating video for ${sequenceName} from ${folderName}...`);
  
  try {
    // Get all images in the folder
    const result = await cloudinary.v2.api.resources({
      type: 'upload',
      prefix: `gek-animations/${folderName}/`,
      max_results: 500,
      resource_type: 'image'
    });
    
    if (!result.resources || result.resources.length === 0) {
      console.log(`❌ No images found in ${folderName}`);
      return null;
    }
    
    // Sort images by creation date to maintain frame order
    const sortedImages = result.resources.sort((a, b) => 
      new Date(a.created_at) - new Date(b.created_at)
    );
    
    console.log(`📸 Found ${sortedImages.length} images for ${sequenceName}`);
    
    // Create video using Cloudinary's video generation
    const videoResult = await cloudinary.v2.uploader.createVideo(
      sortedImages.map(img => img.public_id),
      {
        folder: 'gek-animations/videos',
        resource_type: 'video',
        transformation: [
          { fps: 24, quality: 'auto' },
          { format: 'mp4' }
        ],
        public_id: sequenceName
      }
    );
    
    console.log(`✅ Video created: ${videoResult.secure_url}`);
    return videoResult;
    
  } catch (error) {
    console.error(`❌ Error creating video for ${sequenceName}:`, error.message);
    return null;
  }
}

// Function to create all videos
async function createAllVideos() {
  console.log('🚀 Creating Cloudinary videos from image sequences...\n');
  
  const sequences = [
    { folder: 'background', name: 'background' },
    { folder: 'idle-loop', name: 'idle' },
    { folder: 'sleep-cycle', name: 'sleep' },
    { folder: 'sleep-transition-loop', name: 'sleepTransition' },
    { folder: 'waking-up-loop', name: 'wake' }
  ];
  
  const results = {};
  
  for (const sequence of sequences) {
    const result = await createVideoFromSequence(sequence.folder, sequence.name);
    if (result) {
      results[sequence.name] = result;
    }
    
    // Add delay between video creations to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Generate video manifest
  const videoManifest = {
    fps: 24,
    cloudinary: {
      cloud_name: cloudinary.v2.config().cloud_name,
      transformations: "f_auto,q_auto"
    },
    sequences: {}
  };
  
  Object.keys(results).forEach(sequenceName => {
    const result = results[sequenceName];
    videoManifest.sequences[sequenceName] = {
      video_url: result.secure_url,
      duration: result.duration,
      format: 'mp4',
      loop: sequenceName === 'background' || sequenceName.includes('loop')
    };
  });
  
  // Save video manifest
  const manifestPath = path.join(__dirname, 'public', 'animations', 'manifest-videos.json');
  fs.writeFileSync(manifestPath, JSON.stringify(videoManifest, null, 2));
  
  console.log(`\n✅ Video manifest saved to: ${manifestPath}`);
  console.log('\n📋 Video summary:');
  Object.keys(results).forEach(sequenceName => {
    const result = results[sequenceName];
    console.log(`   - ${sequenceName}: ${result.duration}s, ${result.format}`);
  });
  
  console.log('\n🎉 All videos created successfully!');
  console.log('You can now use the video manifest for much more efficient loading.');
  
  return results;
}

// Check if credentials are set
if (cloudinary.v2.config().cloud_name === 'YOUR_CLOUD_NAME') {
  console.log('❌ Please configure your Cloudinary credentials first!');
} else {
  createAllVideos().catch(console.error);
}
