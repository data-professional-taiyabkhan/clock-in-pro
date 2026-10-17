import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

/** Light/dark theme. The saved choice is applied before first paint by a script in index.html. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem storageKey="clockinpro-theme" disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
