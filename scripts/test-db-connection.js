/**
 * Simple script to test database connection and check user face data
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Database connection - use the same method as the main app
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

// Check if using Neon serverless or standard PostgreSQL
const isNeonDatabase = connectionString.includes('neon.tech') || 
                       connectionString.includes('neon.db');

async function testDatabaseConnection() {
  try {
    console.log('🚀 Testing database connection...');
    
    if (isNeonDatabase) {
      // Use Neon serverless driver
      console.log('Using Neon serverless database...');
      const { Pool, neonConfig } = await import('@neondatabase/serverless');
      const { drizzle } = await import('drizzle-orm/neon-serverless');
      const ws = await import('ws');
      
      neonConfig.webSocketConstructor = ws.default;
      neonConfig.useSecureWebSocket = true;
      neonConfig.pipelineConnect = false;
      neonConfig.pipelineTLS = false;
      neonConfig.fetchConnectionCache = true;

      const pool = new Pool({ 
        connectionString: connectionString,
        connectionTimeoutMillis: 15000,
        idleTimeoutMillis: 60000,
        max: 5,
        maxUses: 1000,
        allowExitOnIdle: false
      });

      const { users } = await import('../shared/schema.ts');
      const { isNotNull } = await import('drizzle-orm');
      const db = drizzle({ client: pool, schema: { users } });
      
      // Test connection
      console.log('✅ Database connection successful');
      
      // Check users with face images
      const usersWithFaceImages = await db
        .select({
          id: users.id,
          email: users.email,
          hasFaceImage: users.faceImageUrl,
          hasFaceEmbedding: users.faceEmbedding
        })
        .from(users)
        .where(isNotNull(users.faceImageUrl));
      
      console.log(`📊 Found ${usersWithFaceImages.length} users with face images:`);
      
      for (const user of usersWithFaceImages) {
        console.log(`   - ${user.email}: Image=${!!user.hasFaceImage}, Embedding=${!!user.hasFaceEmbedding}`);
      }
      
      await pool.end();
      
    } else {
      // Use standard PostgreSQL driver
      console.log('Using standard PostgreSQL database...');
      const { Pool } = await import('pg');
      const { drizzle } = await import('drizzle-orm/node-postgres');
      const { users } = await import('../shared/schema.ts');
      const { isNotNull } = await import('drizzle-orm');

      const pool = new Pool({
        connectionString: connectionString,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });

      const db = drizzle(pool, { schema: { users } });
      
      // Test connection
      console.log('✅ Database connection successful');
      
      // Check users with face images
      const usersWithFaceImages = await db
        .select({
          id: users.id,
          email: users.email,
          hasFaceImage: users.faceImageUrl,
          hasFaceEmbedding: users.faceEmbedding
        })
        .from(users)
        .where(isNotNull(users.faceImageUrl));
      
      console.log(`📊 Found ${usersWithFaceImages.length} users with face images:`);
      
      for (const user of usersWithFaceImages) {
        console.log(`   - ${user.email}: Image=${!!user.hasFaceImage}, Embedding=${!!user.hasFaceEmbedding}`);
      }
      
      await pool.end();
    }
    
    console.log('✅ Database test completed successfully!');
    
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

testDatabaseConnection();
