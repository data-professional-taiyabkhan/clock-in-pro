#!/usr/bin/env node
/**
 * Simple AWS Test - Just test credentials
 */

import dotenv from 'dotenv';
import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3';
import { RekognitionClient, ListCollectionsCommand } from '@aws-sdk/client-rekognition';

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

console.log('\n🧪 Simple AWS Credentials Test\n');

// Check environment
console.log('Environment:');
console.log(`  AWS_REGION: ${process.env.AWS_REGION || 'NOT SET'}`);
console.log(`  AWS_ACCESS_KEY_ID: ${process.env.AWS_ACCESS_KEY_ID ? process.env.AWS_ACCESS_KEY_ID.substring(0, 8) + '...' : 'NOT SET'}`);
console.log(`  AWS_SECRET_ACCESS_KEY: ${process.env.AWS_SECRET_ACCESS_KEY ? '***' + process.env.AWS_SECRET_ACCESS_KEY.substring(process.env.AWS_SECRET_ACCESS_KEY.length - 4) : 'NOT SET'}`);
console.log(`  AWS_S3_BUCKET: ${process.env.AWS_S3_BUCKET || 'NOT SET'}`);

// Test S3
console.log('\n--- Testing S3 ---');
try {
  const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'eu-west-2',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
  });
  
  const command = new ListBucketsCommand({});
  const response = await s3Client.send(command);
  
  success('S3 credentials are valid!');
  info(`You have ${response.Buckets?.length || 0} buckets`);
  
  if (response.Buckets && response.Buckets.length > 0) {
    console.log('\nYour buckets:');
    response.Buckets.forEach(bucket => {
      const isMine = bucket.Name === process.env.AWS_S3_BUCKET;
      console.log(`  ${isMine ? '→' : ' '} ${bucket.Name} ${isMine ? '(your bucket)' : ''}`);
    });
  }
  
} catch (err) {
  error(`S3 test failed: ${err.message}`);
  
  if (err.message.includes('UnrecognizedClientException') || err.message.includes('InvalidClientTokenId')) {
    console.log('\nThis means your AWS credentials are wrong!');
    console.log('Fix:');
    console.log('  1. Go to IAM Console');
    console.log('  2. Create new access keys');
    console.log('  3. Update .env file');
  }
  
  if (err.message.includes('SignatureDoesNotMatch')) {
    console.log('\nThis means your AWS Secret Key is wrong!');
    console.log('Fix: Check AWS_SECRET_ACCESS_KEY in .env');
  }
}

// Test Rekognition
console.log('\n--- Testing Rekognition ---');
try {
  const rekognitionClient = new RekognitionClient({
    region: process.env.AWS_REGION || 'eu-west-2',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
  });
  
  const command = new ListCollectionsCommand({});
  const response = await rekognitionClient.send(command);
  
  success('Rekognition credentials are valid!');
  info(`You have ${response.CollectionIds?.length || 0} collections`);
  
  if (response.CollectionIds && response.CollectionIds.length > 0) {
    console.log('Your collections:');
    response.CollectionIds.forEach(collection => {
      console.log(`  - ${collection}`);
    });
  }
  
} catch (err) {
  error(`Rekognition test failed: ${err.message}`);
  
  if (err.message.includes('UnrecognizedClientException')) {
    console.log('\nYour AWS credentials are invalid or expired!');
  }
}

console.log('\n');

