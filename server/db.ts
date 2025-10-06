import dotenv from "dotenv";

// Load environment variables
dotenv.config();

import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Check if using Neon serverless (for Replit) or standard PostgreSQL (for local)
const isNeonDatabase = process.env.DATABASE_URL.includes('neon.tech') || 
                       process.env.DATABASE_URL.includes('neon.db');

let db: any;
let pool: any;

if (isNeonDatabase) {
  // Use Neon serverless driver for cloud deployment
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
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 15000,
    idleTimeoutMillis: 60000,
    max: 5,
    maxUses: 1000,
    allowExitOnIdle: false
  });

  pool.on('error', (err: any) => {
    console.error('Database pool error:', err);
  });

  pool.on('connect', () => {
    console.log('Neon database connected successfully');
  });

  db = drizzle({ client: pool, schema });
} else {
  // Use standard PostgreSQL driver for local development
  console.log('Using standard PostgreSQL database...');
  const { Pool } = await import('pg');
  const { drizzle } = await import('drizzle-orm/node-postgres');

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  pool.on('error', (err: any) => {
    console.error('Database pool error:', err);
  });

  pool.on('connect', () => {
    console.log('PostgreSQL database connected successfully');
  });

  db = drizzle(pool, { schema });
}

export { db, pool };