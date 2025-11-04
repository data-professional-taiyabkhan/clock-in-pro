#!/usr/bin/env node
/**
 * Test AWS Setup Script
 * 
 * This script tests your AWS configuration and services
 * Run: node scripts/test-aws-setup.js
 */

import dotenv from 'dotenv';
import { initializeCollection, getCollectionStats, analyzeFaceQuality } from '../server/aws-rekognition.js';
import { getBucketStats, uploadFaceImage } from '../server/aws-s3-storage.js';
import fs from 'fs';
import path from 'path';

dotenv.config();

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
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

function warning(msg) {
  console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`);
}

// Test 1: Check environment variables
function testEnvironmentVariables() {
  console.log('\n' + '='.repeat(60));
  console.log('1️⃣  Testing Environment Variables');
  console.log('='.repeat(60));

  const required = {
    'AWS_REGION': process.env.AWS_REGION,
    'AWS_ACCESS_KEY_ID': process.env.AWS_ACCESS_KEY_ID,
    'AWS_SECRET_ACCESS_KEY': process.env.AWS_SECRET_ACCESS_KEY,
    'AWS_S3_BUCKET': process.env.AWS_S3_BUCKET,
    'AWS_REKOGNITION_COLLECTION': process.env.AWS_REKOGNITION_COLLECTION,
  };

  let allPresent = true;

  for (const [key, value] of Object.entries(required)) {
    if (value) {
      // Mask sensitive values
      const displayValue = key.includes('SECRET') || key.includes('KEY')
        ? value.substring(0, 4) + '...' + value.substring(value.length - 4)
        : value;
      success(`${key}: ${displayValue}`);
    } else {
      error(`${key}: Not set`);
      allPresent = false;
    }
  }

  return allPresent;
}

// Test 2: Test S3 connection
async function testS3Connection() {
  console.log('\n' + '='.repeat(60));
  console.log('2️⃣  Testing S3 Connection');
  console.log('='.repeat(60));

  try {
    const stats = await getBucketStats();
    
    if (!stats.configured) {
      error('S3 not configured');
      return false;
    }

    success(`S3 Bucket: ${stats.bucketName}`);
    success(`Region: ${stats.region}`);

    // Test upload with a small test image
    info('Testing S3 upload with sample image...');
    
    // Create a simple 1x1 pixel red image in base64
    const testImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
    
    const testUserId = 999999; // Test user ID
    const uploadResult = await uploadFaceImage(testUserId, testImageBase64);

    if (uploadResult.success) {
      success('S3 upload test successful');
      info(`Test image uploaded to: ${uploadResult.s3Key}`);
      
      // Clean up test image
      const { deleteFaceImage } = await import('../server/aws-s3-storage.js');
      await deleteFaceImage(uploadResult.imageUrl);
      info('Test image cleaned up');
      
      return true;
    } else {
      error(`S3 upload test failed: ${uploadResult.error}`);
      return false;
    }
  } catch (err) {
    error(`S3 test failed: ${err.message}`);
    return false;
  }
}

// Test 3: Test Rekognition connection
async function testRekognitionConnection() {
  console.log('\n' + '='.repeat(60));
  console.log('3️⃣  Testing AWS Rekognition');
  console.log('='.repeat(60));

  try {
    // Test collection initialization
    info('Initializing Rekognition collection...');
    const initialized = await initializeCollection();
    
    if (!initialized) {
      error('Failed to initialize Rekognition collection');
      return false;
    }

    success('Rekognition collection initialized');

    // Get collection stats
    const stats = await getCollectionStats();
    success(`Collection: ${stats.collectionId}`);
    info(`Current face count: ${stats.faceCount}`);

    // Test face quality analysis with sample image
    info('Testing face quality analysis...');
    const testImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
    
    const qualityResult = await analyzeFaceQuality(testImageBase64);
    
    if (!qualityResult.faceDetected) {
      warning('No face detected in test image (expected - using tiny test image)');
    }
    
    success('Rekognition API is responding');
    return true;
  } catch (err) {
    error(`Rekognition test failed: ${err.message}`);
    return false;
  }
}

// Test 4: Test database connection
async function testDatabaseConnection() {
  console.log('\n' + '='.repeat(60));
  console.log('4️⃣  Testing Database Connection');
  console.log('='.repeat(60));

  try {
    // Import pool directly using the same logic as db.ts
    const pkg = await import('pg');
    const { Pool } = pkg.default || pkg;
    
    info('Connecting to database...');
    
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    await pool.end();
    
    success('Database connection successful');
    info('Database is accessible');
    
    return true;
  } catch (err) {
    error(`Database test failed: ${err.message}`);
    return false;
  }
}

// Main test function
async function runTests() {
  console.log('🧪 AWS Setup Test Suite');
  console.log('Testing your AWS configuration and connectivity\n');

  const results = {
    envVars: false,
    s3: false,
    rekognition: false,
    database: false,
  };

  // Run tests
  results.envVars = testEnvironmentVariables();
  
  if (results.envVars) {
    results.s3 = await testS3Connection();
    results.rekognition = await testRekognitionConnection();
    results.database = await testDatabaseConnection();
  } else {
    warning('Skipping service tests due to missing environment variables');
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));

  const tests = [
    { name: 'Environment Variables', passed: results.envVars },
    { name: 'S3 Connection', passed: results.s3 },
    { name: 'AWS Rekognition', passed: results.rekognition },
    { name: 'Database Connection', passed: results.database },
  ];

  tests.forEach(test => {
    if (test.passed) {
      success(test.name);
    } else {
      error(test.name);
    }
  });

  const allPassed = Object.values(results).every(r => r);

  console.log('\n' + '='.repeat(60));
  if (allPassed) {
    console.log(`${colors.green}🎉 All tests passed! Your AWS setup is ready.${colors.reset}`);
    console.log('\nYou can now:');
    console.log('  1. Run the migration: node scripts/migrate-to-aws.js');
    console.log('  2. Start your application: npm run dev');
  } else {
    console.log(`${colors.red}❌ Some tests failed. Please fix the issues above.${colors.reset}`);
    console.log('\nCommon fixes:');
    console.log('  1. Check your .env file has all required AWS variables');
    console.log('  2. Verify your AWS credentials are correct');
    console.log('  3. Ensure your S3 bucket exists and is accessible');
    console.log('  4. Check your AWS IAM permissions');
  }
  console.log('='.repeat(60));

  return allPassed;
}

// Run tests
runTests()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  });

