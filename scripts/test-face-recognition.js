/**
 * Test script to verify face recognition is working correctly
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

// Test face recognition
async function testFaceRecognition(userEmail) {
  try {
    // Initialize database connection
    const { db: database, pool: databasePool } = await initializeDatabase();
    
    console.log(`🔍 Testing face recognition for user: ${userEmail}`);
    
    // Import schema and operators
    const { users } = await import('../shared/schema.ts');
    const { eq } = await import('drizzle-orm');
    
    // Get user from database
    const user = await database
      .select()
      .from(users)
      .where(eq(users.email, userEmail))
      .limit(1);
    
    if (user.length === 0) {
      console.log(`❌ User not found: ${userEmail}`);
      return;
    }
    
    const userData = user[0];
    console.log(`📊 User data:`);
    console.log(`   - ID: ${userData.id}`);
    console.log(`   - Email: ${userData.email}`);
    console.log(`   - Has face image: ${!!userData.faceImageUrl}`);
    console.log(`   - Has face embedding: ${!!userData.faceEmbedding}`);
    console.log(`   - Face embedding length: ${userData.faceEmbedding ? JSON.parse(userData.faceEmbedding).length : 0}`);
    
    if (!userData.faceImageUrl) {
      console.log(`❌ No face image registered for ${userEmail}`);
      return;
    }
    
    // Test if we can generate an embedding from the face image
    console.log(`🔄 Testing embedding generation from face image...`);
    
    const embeddingResult = await new Promise((resolve) => {
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
      
      const inputData = JSON.stringify({ image_data: userData.faceImageUrl });
      pythonProcess.stdin.write(inputData);
      pythonProcess.stdin.end();
    });
    
    if (embeddingResult.success) {
      console.log(`✅ Successfully generated embedding with ${embeddingResult.embedding.length} dimensions`);
      
      // Test face comparison if we have a stored embedding
      if (userData.faceEmbedding) {
        console.log(`🔄 Testing face comparison...`);
        
        const comparisonResult = await new Promise((resolve) => {
          const pythonProcess = spawn(getPythonCommand(), ['server/simple_face_recognition.py', 'compare'], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: getPythonEnv()
          });
          
          let output = '';
          let errorOutput = '';
          
          pythonProcess.on('error', (error) => {
            console.error('Failed to start Python process:', error);
            resolve({
              success: false,
              error: `Failed to start face comparison: ${error.message}`
            });
          });
          
          pythonProcess.on('close', (code) => {
            if (code === 0) {
              try {
                const result = JSON.parse(output);
                resolve({
                  success: true,
                  result: result.result
                });
              } catch (parseError) {
                console.error('Failed to parse comparison result:', output);
                resolve({
                  success: false,
                  error: 'Failed to parse comparison result'
                });
              }
            } else {
              console.error('Face comparison failed:', errorOutput);
              resolve({
                success: false,
                error: `Face comparison failed: ${errorOutput}`
              });
            }
          });
          
          const storedEmbedding = JSON.parse(userData.faceEmbedding);
          const inputData = JSON.stringify({
            known_encoding: storedEmbedding,
            unknown_image: userData.faceImageUrl,
            tolerance: 0.6
          });
          pythonProcess.stdin.write(inputData);
          pythonProcess.stdin.end();
        });
        
        if (comparisonResult.success) {
          const { distance, is_match } = comparisonResult.result;
          console.log(`📊 Face comparison result:`);
          console.log(`   - Distance: ${distance.toFixed(4)}`);
          console.log(`   - Threshold: 0.6`);
          console.log(`   - Match: ${is_match ? '✅ YES' : '❌ NO'}`);
          
          if (is_match) {
            console.log(`🎉 Face recognition is working correctly for ${userEmail}!`);
          } else {
            console.log(`⚠️  Face recognition failed - distance too high`);
          }
        } else {
          console.log(`❌ Face comparison failed: ${comparisonResult.error}`);
        }
      } else {
        console.log(`⚠️  No stored embedding found - this user needs to re-register their face`);
      }
    } else {
      console.log(`❌ Failed to generate embedding: ${embeddingResult.error}`);
    }
    
  } catch (error) {
    console.error(`❌ Error testing face recognition for ${userEmail}:`, error);
  } finally {
    if (databasePool) {
      await databasePool.end();
    }
  }
}

// Main function
async function main() {
  try {
    const userEmail = process.argv[2];
    
    if (!userEmail) {
      console.log('Usage: node scripts/test-face-recognition.js <user-email>');
      console.log('Example: node scripts/test-face-recognition.js user@example.com');
      process.exit(1);
    }
    
    console.log('🚀 Starting face recognition test...');
    await testFaceRecognition(userEmail);
    
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

main();
