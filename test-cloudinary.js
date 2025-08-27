import cloudinary from 'cloudinary';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure Cloudinary
cloudinary.v2.config({
  cloud_name: 'dfplfdd0s',
  api_key: '591527698382166',
  api_secret: 'AACTwlmHtBX-Z0VRvpymE4NbMJc'
});

async function testCloudinary() {
  console.log('🔍 Testing Cloudinary connection...\n');
  
  try {
    // Test 1: Try to upload a small test file
    console.log('1. Testing upload with a small file...');
    const testFilePath = path.join(__dirname, 'public', 'animations', 'background', 'backrounddd_00000.webp');
    
    if (fs.existsSync(testFilePath)) {
      const result = await cloudinary.v2.uploader.upload(testFilePath, {
        folder: 'test-upload',
        resource_type: 'image'
      });
      console.log('✅ Test upload successful!');
      console.log(`   File uploaded: ${result.public_id}`);
      console.log(`   URL: ${result.secure_url}`);
      
      // Clean up test file
      await cloudinary.v2.uploader.destroy(result.public_id);
      console.log('✅ Test file cleaned up');
      
      console.log('\n🎉 Cloudinary is working! The 403 error might be due to:');
      console.log('- Rate limiting (too many uploads at once)');
      console.log('- File size limits');
      console.log('- Account restrictions');
      
    } else {
      console.log('❌ Test file not found');
    }
    
  } catch (error) {
    console.error('❌ Cloudinary test failed:', error.message);
    
    if (error.http_code === 401) {
      console.log('\n🔑 Authentication failed. Check your:');
      console.log('- API Key');
      console.log('- API Secret');
      console.log('- Cloud Name');
    } else if (error.http_code === 403) {
      console.log('\n🚫 Permission denied. Possible causes:');
      console.log('- Account has upload restrictions');
      console.log('- API key lacks upload permissions');
      console.log('- Account is on a restricted plan');
    } else if (error.http_code === 429) {
      console.log('\n⏱️ Rate limited. Try uploading fewer files at once.');
    }
  }
}

testCloudinary();
