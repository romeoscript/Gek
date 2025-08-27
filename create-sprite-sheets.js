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

// Function to create sprite sheet from image sequence
async function createSpriteSheet(folderName, sequenceName) {
  console.log(`🎨 Creating sprite sheet for ${sequenceName} from ${folderName}...`);
  
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
    
    // Create sprite sheet using Cloudinary's sprite generation
    // This will combine all images into a single horizontal sprite sheet
    const spriteResult = await cloudinary.v2.uploader.createSprite(
      sortedImages.map(img => img.public_id),
      {
        folder: 'gek-animations/sprites',
        resource_type: 'image',
        transformation: [
          { quality: 'auto', fetch_format: 'auto' }
        ],
        public_id: `${sequenceName}-sprite`
      }
    );
    
    console.log(`✅ Sprite sheet created: ${spriteResult.secure_url}`);
    
    // Get sprite sheet info
    const spriteInfo = await cloudinary.v2.api.resource(spriteResult.public_id, {
      resource_type: 'image'
    });
    
    return {
      url: spriteResult.secure_url,
      width: spriteInfo.width,
      height: spriteInfo.height,
      frameCount: sortedImages.length,
      frameWidth: Math.floor(spriteInfo.width / sortedImages.length),
      frameHeight: spriteInfo.height
    };
    
  } catch (error) {
    console.error(`❌ Error creating sprite sheet for ${sequenceName}:`, error.message);
    return null;
  }
}

// Function to create all sprite sheets
async function createAllSpriteSheets() {
  console.log('🚀 Creating Cloudinary sprite sheets from image sequences...\n');
  
  const sequences = [
    { folder: 'background', name: 'background' },
    { folder: 'idle-loop', name: 'idle' },
    { folder: 'sleep-cycle', name: 'sleep' },
    { folder: 'sleep-transition-loop', name: 'sleepTransition' },
    { folder: 'waking-up-loop', name: 'wake' }
  ];
  
  const results = {};
  
  for (const sequence of sequences) {
    const result = await createSpriteSheet(sequence.folder, sequence.name);
    if (result) {
      results[sequence.name] = result;
    }
    
    // Add delay between sprite creations to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  // Generate sprite sheet manifest
  const spriteManifest = {
    fps: 24,
    cloudinary: {
      cloud_name: cloudinary.v2.config().cloud_name,
      transformations: "f_auto,q_auto"
    },
    sequences: {}
  };
  
  Object.keys(results).forEach(sequenceName => {
    const result = results[sequenceName];
    spriteManifest.sequences[sequenceName] = {
      sprite_url: result.url,
      frameCount: result.frameCount,
      frameWidth: result.frameWidth,
      frameHeight: result.frameHeight,
      spriteWidth: result.width,
      spriteHeight: result.height,
      loop: sequenceName === 'background' || sequenceName.includes('loop')
    };
  });
  
  // Save sprite manifest
  const manifestPath = path.join(__dirname, 'public', 'animations', 'manifest-sprites.json');
  fs.writeFileSync(manifestPath, JSON.stringify(spriteManifest, null, 2));
  
  console.log(`\n✅ Sprite manifest saved to: ${manifestPath}`);
  console.log('\n📋 Sprite sheet summary:');
  Object.keys(results).forEach(sequenceName => {
    const result = results[sequenceName];
    console.log(`   - ${sequenceName}: ${result.frameCount} frames, ${result.frameWidth}x${result.frameHeight} each`);
  });
  
  console.log('\n🎉 All sprite sheets created successfully!');
  console.log('This reduces 724 individual requests to just 5 sprite sheet requests!');
  
  return results;
}

// Check if credentials are set
if (cloudinary.v2.config().cloud_name === 'YOUR_CLOUD_NAME') {
  console.log('❌ Please configure your Cloudinary credentials first!');
} else {
  createAllSpriteSheets().catch(console.error);
}
