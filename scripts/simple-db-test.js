/**
 * Simple database test without TypeScript imports
 */

import dotenv from 'dotenv';
import pkg from 'pg';
const { Pool } = pkg;

// Load environment variables
dotenv.config();

async function testDatabase() {
  try {
    console.log('🚀 Testing database connection...');
    
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      console.error('❌ DATABASE_URL environment variable is required');
      process.exit(1);
    }

    console.log('Using standard PostgreSQL database...');
    
    const pool = new Pool({
      connectionString: connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    // Test basic connection
    const client = await pool.connect();
    console.log('✅ Database connection successful');
    
    // Check if users table exists and has face data
    const result = await client.query(`
      SELECT 
        email,
        face_image_url IS NOT NULL as has_face_image,
        face_embedding IS NOT NULL as has_face_embedding,
        LENGTH(face_embedding::text) as embedding_length
      FROM users 
      WHERE face_image_url IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    console.log(`📊 Found ${result.rows.length} users with face images:`);
    
    if (result.rows.length === 0) {
      console.log('   No users with face images found');
    } else {
      for (const user of result.rows) {
        console.log(`   - ${user.email}: Image=${user.has_face_image}, Embedding=${user.has_face_embedding}, Length=${user.embedding_length}`);
      }
    }
    
    // Check total users
    const totalResult = await client.query('SELECT COUNT(*) as total FROM users');
    console.log(`📈 Total users in database: ${totalResult.rows[0].total}`);
    
    client.release();
    await pool.end();
    
    console.log('✅ Database test completed successfully!');
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
}

testDatabase();
