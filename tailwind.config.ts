import type { Config } from "tailwindcss";

const token = (name: string) => `hsl(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        background: token("background"),
        foreground: token("foreground"),
        card: { DEFAULT: token("card"), foreground: token("card-foreground") },
        popover: { DEFAULT: token("popover"), foreground: token("popover-foreground") },
        primary: { DEFAULT: token("primary"), foreground: token("primary-foreground") },
        secondary: { DEFAULT: token("secondary"), foreground: token("secondary-foreground") },
        muted: { DEFAULT: token("muted"), foreground: token("muted-foreground") },
        accent: { DEFAULT: token("accent"), foreground: token("accent-foreground") },
        destructive: { DEFAULT: token("destructive"), foreground: token("destructive-foreground") },
        success: { DEFAULT: token("success"), foreground: token("success-foreground") },
        warning: { DEFAULT: token("warning"), foreground: token("warning-foreground") },
        info: { DEFAULT: token("info"), foreground: token("info-foreground") },
        border: token("border"),
        input: token("input"),
        ring: token("ring"),
        brand: { from: token("brand-from"), to: token("brand-to") },
        chart: {
          "1": token("chart-1"),
          "2": token("chart-2"),
          "3": token("chart-3"),
          "4": token("chart-4"),
          "5": token("chart-5"),
        },
        sidebar: {
          DEFAULT: token("sidebar-background"),
          foreground: token("sidebar-foreground"),
          primary: token("sidebar-primary"),
          "primary-foreground": token("sidebar-primary-foreground"),
          accent: token("sidebar-accent"),
          "accent-foreground": token("sidebar-accent-foreground"),
          border: token("sidebar-border"),
          ring: token("sidebar-ring"),
        },
      },
      boxShadow: {
        glow: "0 10px 40px -10px hsl(var(--brand-from) / 0.45)",
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
