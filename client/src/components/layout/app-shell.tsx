import type { ReactNode } from "react";
import { ChevronDown, KeyRound, LogOut, UserCircle2 } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface ShellOrg {
  name: string;
  logoUrl?: string | null;
  brandColor?: string | null;
}

interface AppShellProps {
  user: { firstName: string; lastName: string; email: string; role: string };
  org?: ShellOrg | null;
  onLogout: () => void;
  onChangePassword?: () => void;
  /** Rendered under the top bar (e.g. page title + tabs). */
  header?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function AppShell({ user, org, onLogout, onChangePassword, header, children, className }: AppShellProps) {
  const initials = `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() || "?";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {org?.logoUrl ? (
              <img src={org.logoUrl} alt={org.name} className="h-9 max-w-[140px] object-contain" />
            ) : (
              <Logo withText={false} href={null} glow={false} />
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">{org?.name ?? "Clock-In Pro"}</p>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {user.role === "admin" ? "Admin" : "Employee"} · Clock-In Pro
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-10 gap-2 rounded-full px-2 sm:px-3">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ background: org?.brandColor || undefined }}
                  >
                    <span className={cn("flex h-8 w-8 items-center justify-center rounded-full", !org?.brandColor && "brand-gradient")}>{initials}</span>
                  </span>
                  <span className="hidden max-w-[140px] truncate text-sm sm:inline">{user.firstName}</span>
                  <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:inline" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="font-normal">
                  <p className="text-sm font-semibold">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>
                  <UserCircle2 /> {user.role === "admin" ? "Administrator" : "Employee"}
                </DropdownMenuItem>
                {onChangePassword && (
                  <DropdownMenuItem onSelect={onChangePassword}>
                    <KeyRound /> Change password
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onLogout} className="text-destructive focus:text-destructive">
                  <LogOut /> Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {header && <div className="mx-auto max-w-7xl px-4 sm:px-6">{header}</div>}
      </div>

      <main className={cn("mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8", className)}>{children}</main>
    </div>
  );
}

export function PageTitle({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 pb-4 pt-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
