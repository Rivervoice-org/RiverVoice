/** @type {import('tailwindcss').Config} */

/**
 * Reads a theme color from the CSS variables set by ThemeProvider (see
 * lib/theme.tsx), so every className using this token repaints on scheme
 * change without a `dark:` variant at each call site.
 */
function withOpacity(name) {
  return `rgb(var(--color-${name}) / <alpha-value>)`;
}

module.exports = {
  content: ["./App.tsx", "./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}", "./lib/**/*.{js,jsx,ts,tsx}", "./screens/**/*.{js,jsx,ts,tsx}", "./state/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        canvas: withOpacity("canvas"),
        background: withOpacity("background"),
        foreground: withOpacity("foreground"),
        card: withOpacity("card"),
        popover: withOpacity("popover"),
        primary: {
          DEFAULT: withOpacity("primary"),
          foreground: withOpacity("primary-foreground"),
        },
        secondary: {
          DEFAULT: withOpacity("secondary"),
          foreground: withOpacity("secondary-foreground"),
        },
        muted: {
          DEFAULT: withOpacity("muted"),
          foreground: withOpacity("muted-foreground"),
        },
        accent: {
          DEFAULT: withOpacity("accent"),
          foreground: withOpacity("accent-foreground"),
        },
        destructive: {
          DEFAULT: withOpacity("destructive"),
          foreground: withOpacity("destructive-foreground"),
        },
        border: withOpacity("border"),
        input: withOpacity("input"),
        ring: withOpacity("ring"),
        river: {
          DEFAULT: withOpacity("river"),
          tint: withOpacity("river-tint"),
        },
        amber: {
          DEFAULT: withOpacity("amber"),
          tint: withOpacity("amber-tint"),
        },
        green: {
          DEFAULT: withOpacity("green"),
          tint: withOpacity("green-tint"),
        },
      },
      borderRadius: {
        sm: "6px",
        md: "8px",
        lg: "10px",
        xl: "12px",
        "2xl": "16px",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        serif: ["Newsreader", "Georgia", "serif"],
        mono: ["Geist Mono", "ui-monospace", "monospace"],
      },
      fontSize: {
        "display-lg": ["40px", { lineHeight: "1.04", letterSpacing: "-0.04em", fontWeight: "600" }],
        "display": ["32px", { lineHeight: "1.1", letterSpacing: "-0.03em", fontWeight: "600" }],
        "display-sm": ["24px", { lineHeight: "1.15", letterSpacing: "-0.03em", fontWeight: "600" }],
        "eyebrow": ["11px", { lineHeight: "1.4", letterSpacing: "0.14em", fontWeight: "500" }],
        "body-lg": ["17px", { lineHeight: "1.75" }],
        "body": ["15px", { lineHeight: "1.7" }],
      },
      boxShadow: {
        float: "0 1px 3px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.06)",
        lift: "0 4px 12px 0 rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.06)",
        soft: "0 2px 8px 0 rgba(0,0,0,0.06)",
      },
    },
  },
  plugins: [],
}
