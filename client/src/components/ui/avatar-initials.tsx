import { cn } from "@/lib/utils";

export function AvatarInitials({ name, className, color }: { name: string; className?: string; color?: string | null }) {
  const parts = name.trim().split(/\s+/);
  const text = `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase() || "?";
  return (
    <span
      className={cn("inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white", !color && "brand-gradient", className)}
      style={color ? { background: color } : undefined}
      aria-hidden
    >
      {text}
    </span>
  );
}
