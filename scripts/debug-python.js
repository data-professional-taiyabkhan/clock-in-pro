/**
 * Debug script to test Python face recognition output
 */

import dotenv from 'dotenv';
import pkg from 'pg';
const { Pool } = pkg;
import { spawn } from 'child_process';

dotenv.config();

async function debugPython() {
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    const client = await pool.connect();
    
    // Get one face image to test
    const result = await client.query(`
      SELECT face_image_url 
      FROM users 
      WHERE face_image_url IS NOT NULL 
      LIMIT 1
    `);
    
    if (result.rows.length === 0) {
      console.log('No face images found');
      await client.release();
      await pool.end();
      return;
    }
    
    const imageData = result.rows[0].face_image_url;
    console.log('Image data length:', imageData.length);
    console.log('Image data starts with:', imageData.substring(0, 50));
    
    // Test Python script
    const pythonProcess = spawn('python', ['server/simple_face_recognition.py', 'encode'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let output = '';
    let errorOutput = '';
    
    pythonProcess.stdout.on('data', (data) => {
      const dataStr = data.toString();
      console.log('Python stdout:', dataStr);
      output += dataStr;
    });
    
    pythonProcess.stderr.on('data', (data) => {
      const dataStr = data.toString();
      console.log('Python stderr:', dataStr);
      errorOutput += dataStr;
    });
    
    pythonProcess.on('close', (code) => {
      console.log('Python process closed with code:', code);
      console.log('Final output:', output);
      console.log('Final error:', errorOutput);
      
      if (code === 0) {
        try {
          const result = JSON.parse(output);
          console.log('Parsed result:', JSON.stringify(result, null, 2));
        } catch (parseError) {
          console.error('Parse error:', parseError);
        }
      }
      
      client.release();
      pool.end();
    });
    
    const inputData = JSON.stringify({ image_data: imageData });
    console.log('Sending input data length:', inputData.length);
    pythonProcess.stdin.write(inputData);
    pythonProcess.stdin.end();
    
  } catch (error) {
    console.error('Script failed:', error);
  }
}

debugPython();
