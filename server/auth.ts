import bcrypt from "bcryptjs";
import { storage } from "./storage";
import type { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import type { User } from "@shared/schema";
import { pool } from "./db";

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  return bcrypt.compare(supplied, stored);
}

export function setupAuth(app: Express) {
  const PgStore = connectPgSimple(session);

  app.use(session({
    store: new PgStore({
      pool: pool,                    // Use the existing DB pool
      tableName: "user_sessions",    // Table name for sessions
      createTableIfMissing: true,    // Auto-create table on first run
      pruneSessionInterval: 60 * 15, // Clean expired sessions every 15 min
    }),
    secret: process.env.SESSION_SECRET || "your-secret-key-here",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days — persistent like social media apps
      sameSite: "lax",
    },
  }));

  // Authentication middleware — load user from session
  app.use((req: any, res, next) => {
    if (req.session?.userId) {
      storage.getUser(req.session.userId).then(user => {
        req.user = user;
        next();
      }).catch(() => next());
    } else {
      next();
    }
  });
}

// Middleware to require authentication
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

// Middleware to require manager/admin role
export function requireManager(req: Request, res: Response, next: NextFunction) {
  if (!req.user || (req.user.role !== "manager" && req.user.role !== "admin")) {
    return res.status(403).json({ message: "Manager access required" });
  }
  next();
}

// Middleware to require admin role
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

export { hashPassword, comparePasswords };