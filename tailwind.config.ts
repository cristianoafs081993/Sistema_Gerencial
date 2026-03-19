import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // --- TOKENS SEMÂNTICOS (SISTEMA GERENCIAL) ---
        "text-primary":   "hsl(var(--foreground))",
        "text-secondary": "hsl(var(--muted-foreground))",
        "text-muted":     "hsl(var(--muted-foreground) / 0.6)",
        "text-on-dark":   "#ffffff",
        "text-on-brand":  "hsl(var(--primary-foreground))",
        
        "surface-page":     "hsl(var(--background))",
        "surface-section":  "hsl(var(--background) / 0.95)",
        "surface-card":     "hsl(var(--card))",
        "surface-subtle":   "hsl(var(--muted))",
        "surface-elevated": "hsl(var(--card))",
        
        "action-primary":         "hsl(var(--primary))",
        "action-primary-hover":   "hsl(var(--primary) / 0.9)",
        "action-primary-active":  "hsl(var(--primary) / 0.8)",
        "action-secondary":       "hsl(var(--secondary))",
        "action-strong":          "hsl(var(--foreground))",
        "action-strong-hover":    "hsl(var(--foreground) / 0.9)",
        
        "border-default": "hsl(var(--border))",
        "border-subtle":  "hsl(var(--border) / 0.5)",
        "border-focus":   "hsl(var(--ring))",
        
        "status-success": "hsl(var(--success))",
        "status-warning": "hsl(var(--warning))",
        "status-error":   "hsl(var(--destructive))",

        // Legado / Utilitários
        "background-light": "#f4f6fa",
        "background-dark":  "#0d1117",
        "vibrant-blue":     "#3b82f6",
        "purple":           "#a855f7",
        "amber":            "#f59e0b",
        "emerald-green":    "#10b981",
        border:      "hsl(var(--border))",
        input:       "hsl(var(--input))",
        ring:        "hsl(var(--ring))",
        background:  "hsl(var(--background))",
        foreground:  "hsl(var(--foreground))",
        primary: {
          DEFAULT:    "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT:    "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT:              "hsl(var(--sidebar-background))",
          foreground:           "hsl(var(--sidebar-foreground))",
          primary:              "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent:               "hsl(var(--sidebar-accent))",
          "accent-foreground":  "hsl(var(--sidebar-accent-foreground))",
          border:               "hsl(var(--sidebar-border))",
          ring:                 "hsl(var(--sidebar-ring))",
        },
      },
      spacing: {
        "space-1":  "4px",
        "space-2":  "8px",
        "space-3":  "12px",
        "space-4":  "16px",
        "space-6":  "24px",
        "space-8":  "32px",
        "space-12": "48px",
        "space-16": "64px",
        "space-20": "80px",
      },
      fontSize: {
        "text-xs":   ["12px", { lineHeight: "1.5" }],
        "text-sm":   ["14px", { lineHeight: "1.5" }],
        "text-base": ["16px", { lineHeight: "1.6" }],
        "text-lg":   ["18px", { lineHeight: "1.6" }],
        "text-xl":   ["20px", { lineHeight: "1.4" }],
        "text-2xl":  ["24px", { lineHeight: "1.3" }],
        "text-3xl":  ["30px", { lineHeight: "1.2" }],
        "text-4xl":  ["36px", { lineHeight: "1.2" }],
        "text-5xl":  ["48px", { lineHeight: "1.1" }],
      },
      fontWeight: {
        "font-normal":   "400",
        "font-medium":   "500",
        "font-semibold": "600",
        "font-bold":     "700",
      },
      borderRadius: {
        "radius-sm":   "6px",
        "radius-md":   "8px",
        "radius-lg":   "12px",
        "radius-xl":   "16px",
        "radius-2xl":  "24px",
        "radius-full": "9999px",
        
        "3xl": "24px",
        "2xl": "16px",
        xl:    "12px",
        lg:    "var(--radius)",
        md:    "calc(var(--radius) - 2px)",
        sm:    "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        "shadow-sm":             "var(--shadow-sm)",
        "shadow-md":             "var(--shadow-md)",
        "shadow-lg":             "var(--shadow-lg)",
        "shadow-card":           "var(--shadow-md)",
        "shadow-card-hover":     "var(--shadow-lg)",
        "shadow-button-primary": "var(--shadow-primary)",

        "xs":      "0 1px 2px 0 rgba(0,0,0,.04)",
        "soft":    "0 1px 3px 0 rgba(0,0,0,.06), 0 1px 2px -1px rgba(0,0,0,.04)",
        "card":    "0 4px 6px -1px rgba(0,0,0,.07), 0 2px 4px -2px rgba(0,0,0,.05)",
        "lifted":  "0 10px 15px -3px rgba(0,0,0,.08), 0 4px 6px -4px rgba(0,0,0,.05)",
        "float":   "0 20px 25px -5px rgba(0,0,0,.08), 0 8px 10px -6px rgba(0,0,0,.04)",
        "primary": "0 4px 14px 0 rgba(26,92,230,.30)",
        "inner-sm":"inset 0 1px 2px rgba(0,0,0,.06)",
      },
      transitionTimingFunction: {
        "spring":    "cubic-bezier(0.16, 1, 0.3, 1)",
        "snappy":    "cubic-bezier(0.4, 0, 0.2, 1)",
        "bounce-in": "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
      },
      transitionDuration: {
        "100": "100ms",
        "150": "150ms",
        "250": "250ms",
        "350": "350ms",
        "400": "400ms",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to:   { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to:   { height: "0" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to:   { opacity: "1", transform: "scale(1)" },
        },
        "shimmer": {
          "0%":   { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up":   "accordion-up 0.2s ease-out",
        "fade-up":        "fade-up 0.35s cubic-bezier(0.16,1,0.3,1) both",
        "scale-in":       "scale-in 0.2s cubic-bezier(0.16,1,0.3,1) both",
        "shimmer":        "shimmer 1.5s infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
