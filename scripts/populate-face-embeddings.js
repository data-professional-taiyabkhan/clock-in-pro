/**
 * Script to populate face embeddings for existing users who have face images
 * but no embeddings stored in the database
 */

import dotenv from 'dotenv';
import { spawn } from 'child_process';
import { existsSync } from 'fs';

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

let db, pool;

async function initializeDatabase() {
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

    pool = new Pool({ 
      connectionString: connectionString,
      connectionTimeoutMillis: 15000,
      idleTimeoutMillis: 60000,
      max: 5,
      maxUses: 1000,
      allowExitOnIdle: false
    });

    const { users } = await import('../shared/schema.ts');
    const { eq } = await import('drizzle-orm');
    db = drizzle({ client: pool, schema: { users } });
  } else {
    // Use standard PostgreSQL driver
    console.log('Using standard PostgreSQL database...');
    const { Pool } = await import('pg');
    const { drizzle } = await import('drizzle-orm/node-postgres');
    const { users } = await import('../shared/schema.ts');
    const { eq } = await import('drizzle-orm');

    pool = new Pool({
      connectionString: connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    db = drizzle(pool, { schema: { users } });
  }
  
  return { db, pool };
}

// Python command detection
function getPythonCommand() {
  if (existsSync('venv/bin/python')) {
    return 'venv/bin/python';
  }
  if (existsSync('.venv/bin/python')) {
    return '.venv/bin/python';
  }
  if (existsSync('test_venv/bin/python')) {
    return 'test_venv/bin/python';
  }
  return 'python3';
}

// Python environment
function getPythonEnv() {
  const env = { ...process.env };
  if (existsSync('venv/bin/activate')) {
    env.PATH = 'venv/bin:' + env.PATH;
  } else if (existsSync('.venv/bin/activate')) {
    env.PATH = '.venv/bin:' + env.PATH;
  } else if (existsSync('test_venv/bin/activate')) {
    env.PATH = 'test_venv/bin:' + env.PATH;
  }
  return env;
}

// Generate face embedding from image
async function generateFaceEmbedding(imageData) {
  return new Promise((resolve) => {
    const pythonProcess = spawn(getPythonCommand(), ['server/simple_face_recognition.py', 'generate'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: getPythonEnv()
    });
    
    let output = '';
    let errorOutput = '';
    
    pythonProcess.on('error', (error) => {
      console.error('Failed to start Python process:', error);
      resolve({
        success: false,
        error: `Failed to start embedding generation: ${error.message}`
      });
    });
    
    pythonProcess.stdin.on('error', (error) => {
      console.error('Python stdin error:', error);
    });
    
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(output);
          resolve({
            success: true,
            embedding: result.embedding
          });
        } catch (parseError) {
          console.error('Failed to parse embedding result:', output);
          resolve({
            success: false,
            error: 'Failed to parse embedding result'
          });
        }
      } else {
        console.error('Embedding generation failed:', errorOutput);
        resolve({
          success: false,
          error: `Embedding generation failed: ${errorOutput}`
        });
      }
    });
    
    const inputData = JSON.stringify({ image_data: imageData });
    pythonProcess.stdin.write(inputData);
    pythonProcess.stdin.end();
  });
}

// Update user face embedding
async function updateUserFaceEmbedding(database, userId, embedding) {
  try {
    const { users } = await import('../shared/schema.ts');
    const { eq } = await import('drizzle-orm');
    
    await database.update(users)
      .set({ 
        faceEmbedding: embedding,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
    
    return true;
  } catch (error) {
    console.error(`Failed to update embedding for user ${userId}:`, error);
    return false;
  }
}

// Main function
async function populateFaceEmbeddings() {
  try {
    // Initialize database connection
    const { db: database, pool: databasePool } = await initializeDatabase();
    
    console.log('🔍 Finding users with face images but no embeddings...');
    
    // Import schema and operators
    const { users } = await import('../shared/schema.ts');
    const { isNotNull } = await import('drizzle-orm');
    
    // Find users who have face images but no embeddings
    const usersNeedingEmbeddings = await database
      .select({
        id: users.id,
        email: users.email,
        faceImageUrl: users.faceImageUrl
      })
      .from(users)
      .where(
        // Has face image URL but no face embedding
        isNotNull(users.faceImageUrl)
      );
    
    console.log(`📊 Found ${usersNeedingEmbeddings.length} users with face images`);
    
    if (usersNeedingEmbeddings.length === 0) {
      console.log('✅ No users need embedding population');
      return;
    }
    
    let successCount = 0;
    let failureCount = 0;
    
    for (const user of usersNeedingEmbeddings) {
      try {
        console.log(`🔄 Processing user: ${user.email} (ID: ${user.id})`);
        
        if (!user.faceImageUrl) {
          console.log(`⚠️  No face image URL for user ${user.email}`);
          failureCount++;
          continue;
        }
        
        // Generate embedding from the face image
        const embeddingResult = await generateFaceEmbedding(user.faceImageUrl);
        
        if (embeddingResult.success && embeddingResult.embedding) {
          // Update the user with the embedding
          const updateSuccess = await updateUserFaceEmbedding(database, user.id, embeddingResult.embedding);
          
          if (updateSuccess) {
            console.log(`✅ Generated and stored embedding for ${user.email}`);
            successCount++;
          } else {
            console.log(`❌ Failed to store embedding for ${user.email}`);
            failureCount++;
          }
        } else {
          console.log(`❌ Failed to generate embedding for ${user.email}: ${embeddingResult.error}`);
          failureCount++;
        }
        
        // Add a small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`❌ Error processing user ${user.email}:`, error);
        failureCount++;
      }
    }
    
    console.log('\n📊 Summary:');
    console.log(`✅ Successfully processed: ${successCount} users`);
    console.log(`❌ Failed: ${failureCount} users`);
    console.log(`📈 Total: ${usersNeedingEmbeddings.length} users`);
    
    if (successCount > 0) {
      console.log('\n🎉 Face embeddings have been populated successfully!');
      console.log('Users can now use face authentication.');
    }
    
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  } finally {
    if (databasePool) {
      await databasePool.end();
    }
  }
}

// Run the script
console.log('🚀 Starting face embedding population script...');
populateFaceEmbeddings();
