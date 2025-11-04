import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set in your .env file");
}

// Parse DATABASE_URL into components
const dbUrl = new URL(process.env.DATABASE_URL?.replace('?sslmode=require', '') || process.env.DATABASE_URL || '');
const host = dbUrl.hostname;
const port = parseInt(dbUrl.port) || 5432;
const database = dbUrl.pathname.slice(1); // Remove leading '/'
const user = dbUrl.username;
const password = dbUrl.password;

console.log("Database configured:", `${user}@${host}:${port}/${database}`);
console.log("SSL config:", { rejectUnauthorized: false });

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    host,
    port,
    database,
    user,
    password,
    ssl: {
      rejectUnauthorized: false, // Accept self-signed certs from AWS RDS
    },
  },
});
