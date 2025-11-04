#!/usr/bin/env node
/**
 * Test S3 Connection Only
 */

import dotenv from 'dotenv';
import { getBucketStats, uploadFaceImage, deleteFaceImage } from '../server/aws-s3-storage.js';
import pkg from 'pg';
const { Pool } = pkg;

dotenv.config();

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
};

function success(msg) {
  console.log(`${colors.green}✅ ${msg}${colors.reset}`);
}

function error(msg) {
  console.log(`${colors.red}❌ ${msg}${colors.reset}`);
}

function info(msg) {
  console.log(`${colors.cyan}ℹ️  ${msg}${colors.reset}`);
}

async function testS3() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 S3 Bucket Test');
  console.log('='.repeat(60));
  
  // Check config
  if (!process.env.AWS_S3_BUCKET || process.env.AWS_S3_BUCKET === 'your-bucket-name') {
    error('AWS_S3_BUCKET is not configured or still placeholder!');
    console.log('\nPlease:');
    console.log('1. Create an S3 bucket in AWS Console');
    console.log('2. Update .env with: AWS_S3_BUCKET=your-actual-bucket-name');
    return false;
  }
  
  success(`S3 Bucket: ${process.env.AWS_S3_BUCKET}`);
  success(`Region: ${process.env.AWS_REGION || 'eu-west-2'}`);
  
  try {
    info('Testing S3 connection...');
    const stats = await getBucketStats();
    
    if (!stats.configured) {
      error('S3 not configured');
      return false;
    }
    
    success('S3 is configured');
    
    // Test upload
    info('Testing upload...');
    const testImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
    const uploadResult = await uploadFaceImage(999999, testImage);
    
    if (uploadResult.success) {
      success('Upload test successful!');
      info(`Uploaded to: ${uploadResult.s3Key}`);
      
      // Cleanup
      info('Cleaning up test file...');
      await deleteFaceImage(uploadResult.imageUrl);
      success('Cleaned up');
    } else {
      error(`Upload failed: ${uploadResult.error}`);
      return false;
    }
    
    console.log('\n' + '='.repeat(60));
    success('S3 bucket is working perfectly! 🎉');
    console.log('='.repeat(60));
    return true;
    
  } catch (err) {
    error(`S3 test failed: ${err.message}`);
    return false;
  }
}

testS3()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });

