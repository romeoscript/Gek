import cloudinary from 'cloudinary';

// Configure Cloudinary
cloudinary.v2.config({
  cloud_name: 'dxt4avubv',
  api_key: '811677793416199',
  api_secret: 'gCGAuApl_VhLq1VdpsFJbRq94Lk'
});

async function checkMobileUpload() {
  console.log('🔍 Checking what\'s in gek-animations-mobile folder...\n');
  
  try {
    // List resources in the gek-animations-mobile folder
    const result = await cloudinary.v2.api.resources({
      type: 'upload',
      prefix: 'gek-animations-mobile/',
      max_results: 1000
    });
    
    console.log(`📊 Found ${result.resources.length} resources in gek-animations-mobile/`);
    
    // Group by subfolder
    const folders = {};
    result.resources.forEach(resource => {
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
          url: resource.secure_url
        });
      }
    });
    
    // Display results by folder
    for (const [folder, files] of Object.entries(folders)) {
      console.log(`\n📁 ${folder}:`);
      console.log(`   Files: ${files.length}`);
      console.log(`   Sample files:`);
      files.slice(0, 3).forEach(file => {
        console.log(`     - ${file.name}`);
      });
      if (files.length > 3) {
        console.log(`     ... and ${files.length - 3} more`);
      }
    }
    
    // Check if we have the expected structure
    const expectedFolders = ['background', 'idle-loop', 'sleep-cycle', 'sleep-transition', 'wake-up-transition'];
    console.log('\n✅ Expected folders:');
    expectedFolders.forEach(folder => {
      const hasFolder = folders[`gek-animations-mobile/${folder}`] || folders[folder];
      const status = hasFolder ? '✅' : '❌';
      console.log(`   ${status} ${folder}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking Cloudinary:', error.message);
  }
}

checkMobileUpload();
