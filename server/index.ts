import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { registerBillingRoutes } from "./routes/billing.routes";
import { registerPinRoutes } from "./routes/pin.routes";
import { registerPasswordRoutes } from "./routes/password.routes";
import { requireActiveSubscription } from "./middleware/entitlement";
import { startTrialExpiryReminderJob } from "./jobs/trial-expiry-reminder";
import { startAutoClockoutJob } from "./jobs/auto-clockout";
import { setupVite, serveStatic, log } from "./vite";
import { getEnvironment } from "./lib/environment";

const app = express();

// Trust first proxy (Railway, Heroku, etc.) — required for secure cookies behind reverse proxy
app.set("trust proxy", 1);

// Raw body parsing for Stripe webhooks (must be before express.json)
app.use("/api/billing/webhook", express.raw({ type: "application/json" }), (req: any, _res, next) => {
  req.rawBody = req.body;
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Register billing routes (Stripe checkout, webhooks, portal)
  registerBillingRoutes(app);

  // Register PIN and consent routes
  registerPinRoutes(app);

  // Register password reset routes
  registerPasswordRoutes(app);

  // Apply entitlement enforcement to all subsequent API routes
  app.use("/api", requireActiveSubscription);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  const isDev = process.env.NODE_ENV === "development";
  log(`NODE_ENV=${process.env.NODE_ENV}, mode=${isDev ? "development" : "production"}`);

  if (isDev) {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  const port = parseInt(process.env.PORT || "5000");
  server.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
    log(`Environment: ${getEnvironment()}`);

    // Start background jobs
    startTrialExpiryReminderJob();
    startAutoClockoutJob();
  });
})();
