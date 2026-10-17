import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "default" | "primary" | "success" | "warning" | "destructive" | "info";

const toneClasses: Record<Tone, string> = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/15 text-warning",
  destructive: "bg-destructive/10 text-destructive",
  info: "bg-info/10 text-info",
};

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  className?: string;
}

export function StatCard({ label, value, hint, icon, tone = "default", className }: StatCardProps) {
  return (
    <div className={cn("surface p-5 flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground font-medium">{label}</p>
        <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </div>
      {icon && (
        <div className={cn("h-10 w-10 shrink-0 rounded-xl flex items-center justify-center [&>svg]:h-5 [&>svg]:w-5", toneClasses[tone])}>
          {icon}
        </div>
      )}
    </div>
  );
}
