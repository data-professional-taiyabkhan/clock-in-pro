import { Link } from "wouter";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  withText?: boolean;
  href?: string | null;
  className?: string;
}

const sizes = {
  sm: { box: "h-8 w-8 rounded-lg", icon: "h-4 w-4", text: "text-base" },
  md: { box: "h-9 w-9 rounded-xl", icon: "h-5 w-5", text: "text-lg" },
  lg: { box: "h-12 w-12 rounded-2xl", icon: "h-6 w-6", text: "text-2xl" },
};

export function LogoMark({ size = "md", className, glow = true }: { size?: LogoProps["size"]; className?: string; glow?: boolean }) {
  const s = sizes[size ?? "md"];
  return (
    <div className={cn("brand-gradient flex items-center justify-center", glow && "shadow-glow", s.box, className)}>
      <Clock className={cn("text-white", s.icon)} strokeWidth={2.5} />
    </div>
  );
}

export function Logo({ size = "md", withText = true, href = "/", className, glow = true }: LogoProps & { glow?: boolean }) {
  const s = sizes[size];
  const content = (
    <span className={cn("inline-flex items-center gap-2.5 group", className)}>
      <LogoMark size={size} glow={glow} className="transition-transform group-hover:scale-105" />
      {withText && <span className={cn("font-bold tracking-tight brand-gradient-text", s.text)}>Clock-In Pro</span>}
    </span>
  );
  if (!href) return content;
  return (
    <Link href={href} className="inline-flex" aria-label="Clock-In Pro home">
      {content}
    </Link>
  );
}
