import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set in your .env file");
}

console.log("Database URL configured:", process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@'));

export default defineConfig({
  out: path.resolve(__dirname, "./migrations"),
  schema: path.resolve(__dirname, "./shared/schema.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
