#!/usr/bin/env node
/**
 * Simple Database Connection Test
 * Tests ONLY the database connection - no AWS services
 */

import dotenv from 'dotenv';
import pkg from 'pg';
const { Pool } = pkg;

dotenv.config();

// Color codes
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

async function testDatabaseConnection() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 Database Connection Test');
  console.log('='.repeat(60));
  
  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    error('DATABASE_URL is not set in .env file');
    console.log('\nMake sure your .env has:');
    console.log('DATABASE_URL=postgresql://postgres:PASSWORD@HOST:5432/DATABASE');
    return false;
  }
  
  success('DATABASE_URL is set');
  
  // Parse connection info (without showing password)
  try {
    const url = new URL(process.env.DATABASE_URL.replace(/^postgresql:/, 'http:'));
    console.log(`Database Host: ${url.hostname}`);
    console.log(`Database Port: ${url.port || '5432'}`);
    console.log(`Database Name: ${url.pathname.substring(1)}`);
    console.log(`Database User: ${url.username}`);
  } catch (e) {
    info('Could not parse DATABASE_URL, but will try to connect...');
  }
  
  // Try to connect
  let pool;
  try {
    info('Attempting to connect to database...');
    
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1, // Just for testing
      connectionTimeoutMillis: 10000, // 10 seconds timeout
      ssl: {
        rejectUnauthorized: false // AWS RDS uses self-signed certificates
      }
    });
    
    // Test the connection
    const client = await pool.connect();
    success('Database connection successful! 🎉');
    
    // Get database info
    try {
      const result = await client.query('SELECT version()');
      console.log('\nPostgreSQL Version:');
      console.log(result.rows[0].version.split(',')[0]);
    } catch (e) {
      info('Could not retrieve version info');
    }
    
    // Check if tables exist
    try {
      const tablesResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
      `);
      
      if (tablesResult.rows.length > 0) {
        console.log('\nExisting tables:');
        tablesResult.rows.forEach(row => {
          console.log(`  - ${row.table_name}`);
        });
      } else {
        info('No tables found - this is expected for a new database');
      }
    } catch (e) {
      info('Could not list tables');
    }
    
    client.release();
    
    console.log('\n' + '='.repeat(60));
    success('Database is ready! You can now:');
    console.log('  1. Run: npm run db:push (to create tables)');
    console.log('  2. Continue with S3 and Rekognition setup');
    console.log('='.repeat(60));
    
    return true;
    
  } catch (err) {
    error(`Connection failed: ${err.message}`);
    
    console.log('\nCommon issues:');
    
    if (err.message.includes('ECONNREFUSED')) {
      console.log('  • Database host might be wrong or not accessible');
      console.log('  • Check your RDS endpoint in .env');
    }
    
    if (err.message.includes('timeout')) {
      console.log('  • Connection timeout - check security group settings');
      console.log('  • Make sure your IP is allowed in RDS security group');
    }
    
    if (err.message.includes('password authentication failed')) {
      console.log('  • Wrong password - check DATABASE_URL in .env');
    }
    
    if (err.message.includes('database') && err.message.includes('does not exist')) {
      console.log('  • Database name doesn\'t exist');
      console.log('  • Check your DATABASE_URL includes correct database name');
    }
    
    return false;
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

// Run the test
testDatabaseConnection()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });

