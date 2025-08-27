import cloudinary from 'cloudinary';

// Configure Cloudinary (use the same credentials as your upload script)
cloudinary.v2.config({
  cloud_name: 'dxt4avubv', // Replace with your cloud name
  api_key: '811677793416199',       // Replace with your API key
  api_secret: 'gCGAuApl_VhLq1VdpsFJbRq94Lk'  // Replace with your API secret
});

// Function to list all folders and files
async function listCloudinaryFolders() {
  console.log('🔍 Listing Cloudinary folders and files...\n');
  
  try {
    // Get all resources with the gek-animations prefix (handle pagination)
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
    
    const result = { resources: allResources };
    
    if (!result.resources || result.resources.length === 0) {
      console.log('❌ No resources found in gek-animations folder');
      console.log('Make sure you have uploaded files using the upload-to-cloudinary.js script first.');
      return;
    }
    
    console.log(`✅ Found ${result.resources.length} total files\n`);
    
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
    
    // Display folder structure
    console.log('📁 Folder Structure:');
    console.log('===================\n');
    
    Object.keys(folders).sort().forEach(folderName => {
      const files = folders[folderName];
      console.log(`📂 ${folderName}/ (${files.length} files)`);
      
      // Show first few files as examples
      const sampleFiles = files.slice(0, 5);
      sampleFiles.forEach(file => {
        const fileName = file.public_id.split('/').pop();
        console.log(`   📄 ${fileName}`);
      });
      
      if (files.length > 5) {
        console.log(`   ... and ${files.length - 5} more files`);
      }
      
      console.log(`   🔗 Base URL: https://res.cloudinary.com/${cloudinary.v2.config().cloud_name}/image/upload/f_auto,q_auto/gek-animations/${folderName}/`);
      console.log('');
    });
    
    // Summary
    console.log('📊 Summary:');
    console.log('===========');
    console.log(`Total folders: ${Object.keys(folders).length}`);
    console.log(`Total files: ${result.resources.length}`);
    console.log(`Cloud name: ${cloudinary.v2.config().cloud_name}`);
    
    // Show available commands
    console.log('\n💡 Next steps:');
    console.log('1. Run "node get-cloudinary-folders.js" to generate an updated manifest');
    console.log('2. Use the URLs above in your application');
    console.log('3. The base URL format is: https://res.cloudinary.com/[cloud_name]/image/upload/f_auto,q_auto/[folder_path]/[filename]');
    
  } catch (error) {
    console.error('❌ Error fetching resources:', error.message);
    
    if (error.http_code === 401) {
      console.log('\n🔑 Authentication failed. Check your Cloudinary credentials.');
    } else if (error.http_code === 403) {
      console.log('\n🚫 Permission denied. Check your API key permissions.');
    }
  }
}

// Check if credentials are set
if (cloudinary.v2.config().cloud_name === 'YOUR_CLOUD_NAME') {
  console.log('❌ Please configure your Cloudinary credentials first!');
  console.log('\nUpdate the cloudinary.config() in this script with your credentials.');
} else {
  listCloudinaryFolders().catch(console.error);
}
