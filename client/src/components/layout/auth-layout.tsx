import type { CSSProperties, ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

export interface AuthBrand {
  name: string;
  logoUrl?: string | null;
  brandColor?: string | null;
  wallpaperUrl?: string | null;
  wallpaperPreset?: string | null;
}

export const WALLPAPER_PRESETS: Record<string, string> = {
  aurora: "linear-gradient(135deg, #312e81 0%, #4f46e5 45%, #a855f7 100%)",
  ocean: "linear-gradient(135deg, #0f172a 0%, #0369a1 55%, #22d3ee 100%)",
  sunset: "linear-gradient(135deg, #7c2d12 0%, #ea580c 50%, #fbbf24 100%)",
  forest: "linear-gradient(135deg, #052e16 0%, #15803d 55%, #a3e635 100%)",
  graphite: "linear-gradient(135deg, #111827 0%, #374151 60%, #6b7280 100%)",
  rose: "linear-gradient(135deg, #4c0519 0%, #be123c 55%, #fb7185 100%)",
};

interface AuthLayoutProps {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  brand?: AuthBrand | null;
  children: ReactNode;
  footer?: ReactNode;
  width?: "md" | "lg";
}

/** Centred card layout for sign-in, sign-up and reset pages. Accepts organisation branding. */
export function AuthLayout({ title, subtitle, icon, brand, children, footer, width = "md" }: AuthLayoutProps) {
  const hasWallpaper = !!(brand?.wallpaperUrl || (brand?.wallpaperPreset && WALLPAPER_PRESETS[brand.wallpaperPreset]));
  const wallpaperStyle: CSSProperties | undefined = brand?.wallpaperUrl
    ? { backgroundImage: `url(${brand.wallpaperUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
    : brand?.wallpaperPreset && WALLPAPER_PRESETS[brand.wallpaperPreset]
      ? { backgroundImage: WALLPAPER_PRESETS[brand.wallpaperPreset] }
      : undefined;
  const brandStyle = brand?.brandColor ? ({ "--brand-from": hexToHsl(brand.brandColor), "--brand-to": hexToHsl(brand.brandColor, 18), "--primary": hexToHsl(brand.brandColor), "--ring": hexToHsl(brand.brandColor) } as CSSProperties) : undefined;

  return (
    <div className={cn("relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10", !hasWallpaper && "glow-bg")} style={{ ...brandStyle, ...wallpaperStyle }}>
      {hasWallpaper && <div className="absolute inset-0 bg-black/40" />}
      <div className="absolute right-4 top-4 z-20">
        <ThemeToggle className={cn(hasWallpaper && "text-white/80 hover:text-white hover:bg-white/10")} />
      </div>

      <div className={cn("relative z-10 w-full animate-fade-up", width === "lg" ? "max-w-lg" : "max-w-md")}>
        <div className="mb-8 text-center">
          {brand?.logoUrl ? (
            <img src={brand.logoUrl} alt={brand.name} className="mx-auto mb-5 h-16 max-w-[220px] object-contain drop-shadow" />
          ) : (
            <div className="mb-6 flex justify-center">
              <Logo size="lg" />
            </div>
          )}
          {icon && (
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20 [&>svg]:h-7 [&>svg]:w-7">
              {icon}
            </div>
          )}
          <h1 className={cn("text-2xl font-bold tracking-tight", hasWallpaper && "text-white drop-shadow")}>{title}</h1>
          {subtitle && <p className={cn("mt-1.5 text-sm text-muted-foreground", hasWallpaper && "text-white/80")}>{subtitle}</p>}
        </div>

        <div className="glass rounded-2xl p-6 shadow-xl sm:p-8">{children}</div>

        {footer && <div className={cn("mt-6 text-center text-sm text-muted-foreground", hasWallpaper && "text-white/80 [&_a]:text-white")}>{footer}</div>}
        {brand && (
          <p className={cn("mt-8 text-center text-xs text-muted-foreground", hasWallpaper && "text-white/60")}>
            Powered by <span className="font-semibold">Clock-In Pro</span>
          </p>
        )}
      </div>
    </div>
  );
}

/** Convert #rrggbb to an "H S% L%" triplet, optionally shifting the hue for a gradient end. */
export function hexToHsl(hex: string, hueShift = 0): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "243 76% 58%";
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  const hue = (Math.round(h * 360) + hueShift + 360) % 360;
  return `${hue} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
