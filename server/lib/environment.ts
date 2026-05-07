export type AppEnvironment = "development" | "staging" | "production";

export function getEnvironment(): AppEnvironment {
  const explicit = process.env.APP_ENV;
  if (explicit === "staging" || explicit === "production" || explicit === "development") {
    return explicit;
  }
  // Fall back to NODE_ENV inference
  return process.env.NODE_ENV === "production" ? "production" : "development";
}

export const isProduction = () => getEnvironment() === "production";
export const isStaging = () => getEnvironment() === "staging";
export const isDevelopment = () => getEnvironment() === "development";

export function getAppUrl(): string {
  return process.env.APP_URL || "http://localhost:5000";
}
