import cloudinary from 'cloudinary';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure Cloudinary (you'll need to get these from your Cloudinary dashboard)
cloudinary.v2.config({
  cloud_name: 'dxt4avubv', // Replace with your cloud name
  api_key: '811677793416199',       // Replace with your API key
  api_secret: 'gCGAuApl_VhLq1VdpsFJbRq94Lk'  // Replace with your API secret
});

// Function to upload a single file
async function uploadFile(filePath, folder) {
  try {
    const result = await cloudinary.v2.uploader.upload(filePath, {
      folder: `gek-animations/${folder}`,
      resource_type: 'image',
      format: 'webp',
      quality: 'auto',
      fetch_format: 'auto'
    });
    console.log(`✅ Uploaded: ${path.basename(filePath)}`);
    return result;
  } catch (error) {
    console.error(`❌ Failed to upload ${filePath}:`, error.message);
    return null;
  }
}

// Function to upload all files in a directory
async function uploadDirectory(dirPath, folderName) {
  console.log(`\n📁 Uploading ${folderName}...`);
  
  const files = fs.readdirSync(dirPath)
    .filter(file => file.endsWith('.webp'))
    .sort(); // Sort to maintain frame order
  
  console.log(`Found ${files.length} files to upload`);
  
  let uploaded = 0;
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const result = await uploadFile(filePath, folderName);
    if (result) uploaded++;
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`✅ Uploaded ${uploaded}/${files.length} files in ${folderName}`);
  return uploaded;
}

// Main upload function
async function uploadAllAnimations() {
  console.log('🚀 Starting Cloudinary Upload...\n');
  
  const animationsDir = path.join(__dirname, 'public', 'animations');
  const folders = fs.readdirSync(animationsDir)
    .filter(item => fs.statSync(path.join(animationsDir, item)).isDirectory());
  
  let totalUploaded = 0;
  
  for (const folder of folders) {
    const folderPath = path.join(animationsDir, folder);
    const uploaded = await uploadDirectory(folderPath, folder);
    totalUploaded += uploaded;
  }
  
  console.log(`\n🎉 Upload Complete!`);
  console.log(`Total files uploaded: ${totalUploaded}`);
  console.log(`\nNext steps:`);
  console.log(`1. Update your manifest with your Cloudinary cloud name`);
  console.log(`2. Replace local URLs with Cloudinary URLs`);
  console.log(`3. Enjoy 70-80% faster loading! 🚀`);
}

// Check if credentials are set
if (cloudinary.v2.config().cloud_name === 'YOUR_CLOUD_NAME') {
  console.log('❌ Please configure your Cloudinary credentials first!');
  console.log('\n1. Sign up at https://cloudinary.com/');
  console.log('2. Get your credentials from the Dashboard');
  console.log('3. Update the cloudinary.config() in this script');
  console.log('\nOr set environment variables:');
  console.log('CLOUDINARY_CLOUD_NAME=your_cloud_name');
  console.log('CLOUDINARY_API_KEY=your_api_key');
  console.log('CLOUDINARY_API_SECRET=your_api_secret');
} else {
  uploadAllAnimations().catch(console.error);
}
