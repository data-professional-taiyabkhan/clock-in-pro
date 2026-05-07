export function StagingBanner() {
  const env = (import.meta.env.VITE_APP_ENV || "production").toLowerCase();
  if (env === "production") return null;

  const label = env === "staging" ? "STAGING" : "DEVELOPMENT";
  const color = env === "staging" ? "bg-amber-500" : "bg-rose-500";

  return (
    <div className={`${color} text-black text-center text-xs font-bold py-1 px-3 sticky top-0 z-50`}>
      {label} ENVIRONMENT — Not for real customers
    </div>
  );
}
