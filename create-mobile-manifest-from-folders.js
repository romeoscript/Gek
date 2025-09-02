import cloudinary from 'cloudinary';

// Configure Cloudinary
cloudinary.v2.config({
  cloud_name: 'dxt4avubv',
  api_key: '811677793416199',
  api_secret: 'gCGAuApl_VhLq1VdpsFJbRq94Lk'
});

async function fetchAllResources(prefix) {
  const all = [];
  let nextCursor = undefined;
  do {
    const res = await cloudinary.v2.api.resources({
      type: 'upload',
      prefix,
      max_results: 500,
      next_cursor: nextCursor
    });
    if (res.resources && res.resources.length) {
      all.push(...res.resources);
    }
    nextCursor = res.next_cursor;
  } while (nextCursor);
  return all;
}

async function createMobileManifestFromFolders() {
  console.log('🔧 Creating mobile manifest from gek-animations-mobile folders...\n');
  
  try {
    const manifest = {
      fps: 30,
      cloudinary: {
        cloud_name: 'dxt4avubv',
        transformations: 'f_auto,q_auto'
      },
      sequences: {}
    };

    // Get all resources from gek-animations-mobile (paginated)
    const resources = await fetchAllResources('gek-animations-mobile/');

    // Group files by folder
    const folders = {};
    resources.forEach(resource => {
      const path = resource.public_id;
      const parts = path.split('/');
      if (parts.length >= 3) {
        const folder = parts[1]; // gek-animations-mobile/[folder]
        if (!folders[folder]) {
          folders[folder] = [];
        }
        folders[folder].push({
          name: parts[2],
          public_id: path,
          url: resource.secure_url,
          created_at: resource.created_at
        });
      }
    });

    // Create manifest entries for each folder
    for (const [folder, files] of Object.entries(folders)) {
      // Sort files by creation time to maintain order
      files.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      
      // Take every other file for 50% reduction
      const selectedFiles = [];
      for (let i = 0; i < files.length; i += 2) {
        selectedFiles.push(files[i]);
      }
      // Ensure last file is included
      if (files.length > 0 && !selectedFiles.includes(files[files.length - 1])) {
        selectedFiles.push(files[files.length - 1]);
      }

      // Add Cloudinary transformations to URLs
      const transformedUrls = selectedFiles.map(file => {
        const baseUrl = file.url.replace('/upload/', '/upload/f_auto,q_auto,fl_progressive/');
        return baseUrl;
      });

      // Map folder names to match the example manifest format
      let sequenceName;
      switch (folder) {
        case 'background':
          sequenceName = 'background';
          break;
        case 'idle-loop':
          sequenceName = 'idle';
          break;
        case 'sleep-cycle':
          sequenceName = 'sleep';
          break;
        case 'sleep-transition':
          sequenceName = 'sleepTransition';
          break;
        case 'wake-up-transition':
          sequenceName = 'wake';
          break;
        default:
          sequenceName = folder;
      }

      manifest.sequences[sequenceName] = {
        frames: transformedUrls,
        start: 0,
        end: selectedFiles.length - 1,
        loop: sequenceName === 'idle' || sequenceName === 'sleepTransition' || sequenceName === 'wake',
        fileCount: selectedFiles.length,
        originalFrameCount: files.length,
        percentage: Math.round((selectedFiles.length / files.length) * 100)
      };

      console.log(`✅ ${folder} -> ${sequenceName}: ${selectedFiles.length}/${files.length} frames (${Math.round((selectedFiles.length / files.length) * 100)}% reduction)`);
    }

    // Save manifest
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    
    const outputPath = path.join(__dirname, 'public', 'animations', 'manifest-mobile.json');
    fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2));
    
    console.log(`\n🎉 Mobile manifest saved to: ${outputPath}`);
    console.log('\n📊 Final Summary:');
    for (const [sequenceName, config] of Object.entries(manifest.sequences)) {
      console.log(`   ${sequenceName}: ${config.fileCount}/${config.originalFrameCount} frames (${config.percentage}% reduction) - ${config.loop ? 'looping' : 'non-looping'}`);
    }
    
    console.log(`\n🌐 Cloudinary Base: https://res.cloudinary.com/dxt4avubv/image/upload`);
    console.log(`📱 Mobile Folder: gek-animations-mobile`);
    console.log('\n🎯 Next steps:');
    console.log('1. Use this manifest in your mobile view');
    console.log('2. Test the animations on mobile devices');
    console.log('3. Enjoy optimized performance! 🚀');
    
  } catch (error) {
    console.error('❌ Error creating manifest:', error.message);
  }
}

createMobileManifestFromFolders();
