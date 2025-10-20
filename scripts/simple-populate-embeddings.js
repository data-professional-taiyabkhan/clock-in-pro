/**
 * Simple script to populate face embeddings without TypeScript dependencies
 */

import dotenv from 'dotenv';
import pkg from 'pg';
const { Pool } = pkg;
import { spawn } from 'child_process';
import { existsSync } from 'fs';

// Load environment variables
dotenv.config();

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
  // Try python first (Windows), then python3 (Linux/Mac)
  return 'python';
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
    const pythonProcess = spawn(getPythonCommand(), ['server/simple_face_recognition.py', 'encode'], {
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
            embedding: result.encoding || result.embedding
          });
        } catch (parseError) {
          console.error('Failed to parse embedding result:', output);
          resolve({
            success: false,
            error: 'Failed to parse embedding result'
          });
        }
      } else {
          console.error('Embedding generation failed with code:', code);
          console.error('Error output:', errorOutput);
          console.error('Standard output:', output);
          resolve({
            success: false,
            error: `Embedding generation failed with code ${code}: ${errorOutput}`
          });
        }
    });
    
    const inputData = JSON.stringify({ image_data: imageData });
    pythonProcess.stdin.write(inputData);
    pythonProcess.stdin.end();
  });
}

async function populateEmbeddings() {
  try {
    console.log('🚀 Starting face embedding population...');
    
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      console.error('❌ DATABASE_URL environment variable is required');
      process.exit(1);
    }

    const pool = new Pool({
      connectionString: connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    // Get users with face images but no embeddings
    const client = await pool.connect();
    
    const result = await client.query(`
      SELECT id, email, face_image_url
      FROM users 
      WHERE face_image_url IS NOT NULL 
        AND (face_embedding IS NULL OR face_embedding::text = 'null' OR face_embedding::text = '' OR face_embedding::text = '""')
      ORDER BY created_at DESC
    `);
    
    console.log(`📊 Found ${result.rows.length} users needing embeddings`);
    
    if (result.rows.length === 0) {
      console.log('✅ No users need embedding population');
      await client.release();
      await pool.end();
      return;
    }
    
    let successCount = 0;
    let failureCount = 0;
    
    for (const user of result.rows) {
      try {
        console.log(`🔄 Processing user: ${user.email} (ID: ${user.id})`);
        
        // Generate embedding from the face image
        console.log(`   - Face image URL length: ${user.face_image_url ? user.face_image_url.length : 'null'}`);
        const embeddingResult = await generateFaceEmbedding(user.face_image_url);
        console.log(`   - Embedding result:`, embeddingResult);
        
        if (embeddingResult.success && embeddingResult.embedding) {
          // Update the user with the embedding
          const updateResult = await client.query(
            'UPDATE users SET face_embedding = $1, updated_at = NOW() WHERE id = $2',
            [JSON.stringify(embeddingResult.embedding), user.id]
          );
          
          if (updateResult.rowCount > 0) {
            console.log(`✅ Generated and stored embedding for ${user.email}`);
            successCount++;
          } else {
            console.log(`❌ Failed to update embedding for ${user.email}`);
            failureCount++;
          }
        } else {
          console.log(`❌ Failed to generate embedding for ${user.email}: ${embeddingResult.error || 'Unknown error'}`);
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
    console.log(`📈 Total: ${result.rows.length} users`);
    
    if (successCount > 0) {
      console.log('\n🎉 Face embeddings have been populated successfully!');
      console.log('Users can now use face authentication.');
    }
    
    await client.release();
    await pool.end();
    
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

populateEmbeddings();
