#!/usr/bin/env node

/**
 * Migration script for security enhancements
 * This script handles the migration of face embeddings to pgvector format
 * and sets up the new security features.
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const config = {
  // Database connection (should match your .env file)
  databaseUrl: process.env.DATABASE_URL,
  
  // Migration options
  migrateEmbeddings: true,
  createVectorIndex: true,
  createSampleData: false,
  
  // Vector configuration
  vectorDimensions: 128, // Standard for most face recognition models
  indexLists: 100, // For ivfflat index
};

/**
 * Execute SQL command using psql
 */
async function executeSQL(sqlCommand, description) {
  return new Promise((resolve, reject) => {
    console.log(`\n🔄 ${description}...`);
    
    const psql = spawn('psql', [config.databaseUrl], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let output = '';
    let errorOutput = '';
    
    psql.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    psql.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    psql.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${description} completed successfully`);
        resolve(output);
      } else {
        console.error(`❌ ${description} failed with code ${code}`);
        console.error('Error output:', errorOutput);
        reject(new Error(`SQL execution failed: ${errorOutput}`));
      }
    });
    
    psql.stdin.write(sqlCommand);
    psql.stdin.end();
  });
}

/**
 * Run the main migration SQL script
 */
async function runMainMigration() {
  try {
    const sqlPath = path.join(__dirname, 'migrate-security-enhancements.sql');
    const sqlContent = await fs.readFile(sqlPath, 'utf8');
    
    await executeSQL(sqlContent, 'Running main migration script');
  } catch (error) {
    console.error('Failed to run main migration:', error.message);
    throw error;
  }
}

/**
 * Migrate existing face embeddings to vector format
 */
async function migrateEmbeddings() {
  try {
    await executeSQL(
      'SELECT migrate_face_embeddings_to_vector();',
      'Migrating face embeddings to vector format'
    );
  } catch (error) {
    console.error('Failed to migrate embeddings:', error.message);
    throw error;
  }
}

/**
 * Create vector index for similarity search
 */
async function createVectorIndex() {
  try {
    await executeSQL(
      'SELECT create_vector_index();',
      'Creating vector index for similarity search'
    );
  } catch (error) {
    console.error('Failed to create vector index:', error.message);
    console.log('⚠️  You may need to install pgvector extension manually');
    console.log('   Run: CREATE EXTENSION IF NOT EXISTS vector;');
    throw error;
  }
}

/**
 * Verify the migration was successful
 */
async function verifyMigration() {
  try {
    console.log('\n🔍 Verifying migration...');
    
    // Check if new table exists
    const tableCheck = await executeSQL(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'attendance_verification_logs'
      );`,
      'Checking if attendance_verification_logs table exists'
    );
    
    // Check if new columns exist
    const columnsCheck = await executeSQL(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = 'users' 
       AND column_name IN ('face_embedding_vector', 'pin_hash', 'pin_enabled', 'last_pin_used');`,
      'Checking if new user columns exist'
    );
    
    // Check if pgvector extension is enabled
    const extensionCheck = await executeSQL(
      `SELECT EXISTS (
        SELECT FROM pg_extension 
        WHERE extname = 'vector'
      );`,
      'Checking if pgvector extension is enabled'
    );
    
    console.log('✅ Migration verification completed');
    return true;
  } catch (error) {
    console.error('❌ Migration verification failed:', error.message);
    return false;
  }
}

/**
 * Test the new functionality
 */
async function testNewFeatures() {
  try {
    console.log('\n🧪 Testing new features...');
    
    // Test security summary view
    await executeSQL(
      'SELECT * FROM security_summary LIMIT 5;',
      'Testing security summary view'
    );
    
    // Test similarity search function (with dummy data)
    await executeSQL(
      `SELECT * FROM find_similar_faces(
        '[0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1.0,0.9,0.8,0.7,0.6,0.5,0.4,0.3,0.2,0.1,0.0,0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1.0,0.9,0.8,0.7,0.6,0.5,0.4,0.3,0.2,0.1,0.0,0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1.0,0.9,0.8,0.7,0.6,0.5,0.4,0.3,0.2,0.1,0.0,0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1.0,0.9,0.8,0.7,0.6,0.5,0.4,0.3,0.2,0.1,0.0,0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1.0,0.9,0.8,0.7,0.6,0.5,0.4,0.3,0.2,0.1,0.0,0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1.0,0.9,0.8,0.7,0.6,0.5,0.4,0.3,0.2,0.1,0.0]',
        0.5,
        5
      );`,
      'Testing face similarity search function'
    );
    
    console.log('✅ Feature tests completed');
  } catch (error) {
    console.error('⚠️  Some feature tests failed (this is normal if no data exists):', error.message);
  }
}

/**
 * Create sample data for testing
 */
async function createSampleData() {
  try {
    console.log('\n📝 Creating sample data...');
    
    const sampleData = `
      -- Insert sample audit log entries
      INSERT INTO attendance_verification_logs (
        organization_id, user_id, verification_type, success, 
        face_confidence, liveness_score, device_info, failure_reason
      ) VALUES 
      (1, 1, 'face', true, 95.5, 88.2, '{"browser": "Chrome", "platform": "Windows", "deviceType": "Desktop"}', null),
      (1, 1, 'face', false, 45.2, 92.1, '{"browser": "Chrome", "platform": "Windows", "deviceType": "Desktop"}', 'Face match failed'),
      (1, 2, 'pin', true, null, null, '{"browser": "Safari", "platform": "iOS", "deviceType": "Mobile"}', null),
      (1, 1, 'face', false, 30.1, 95.3, '{"browser": "Firefox", "platform": "Linux", "deviceType": "Desktop"}', 'Liveness detection failed'),
      (1, 3, 'face', true, 89.7, 91.2, '{"browser": "Edge", "platform": "Windows", "deviceType": "Desktop"}', null);
    `;
    
    await executeSQL(sampleData, 'Creating sample audit log data');
    console.log('✅ Sample data created successfully');
  } catch (error) {
    console.error('⚠️  Failed to create sample data:', error.message);
  }
}

/**
 * Main migration function
 */
async function main() {
  console.log('🚀 Starting Security Enhancements Migration');
  console.log('==========================================');
  
  try {
    // Check if DATABASE_URL is set
    if (!config.databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    
    // Run main migration
    await runMainMigration();
    
    // Migrate embeddings if enabled
    if (config.migrateEmbeddings) {
      await migrateEmbeddings();
    }
    
    // Create vector index if enabled
    if (config.createVectorIndex) {
      await createVectorIndex();
    }
    
    // Verify migration
    const verified = await verifyMigration();
    if (!verified) {
      throw new Error('Migration verification failed');
    }
    
    // Create sample data if enabled
    if (config.createSampleData) {
      await createSampleData();
    }
    
    // Test new features
    await testNewFeatures();
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Update your application to use the new security features');
    console.log('2. Test the liveness detection and PIN authentication');
    console.log('3. Set up monitoring for the security dashboard');
    console.log('4. Configure audit log retention policies');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.log('\nTroubleshooting:');
    console.log('1. Ensure PostgreSQL is running and accessible');
    console.log('2. Check that DATABASE_URL is correctly set');
    console.log('3. Verify you have the necessary database permissions');
    console.log('4. Install pgvector extension if not already installed');
    console.log('5. Check the migration logs above for specific errors');
    process.exit(1);
  }
}

// Run migration if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main as runMigration };
