/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.tsx", "./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}", "./lib/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        canvas: "#f5f5f5",
        background: "#ffffff",
        foreground: "#3c3832",
        card: "#ffffff",
        popover: "#ffffff",
        primary: {
          DEFAULT: "#2e2a25",
          foreground: "#fcfbf9",
        },
        secondary: {
          DEFAULT: "#f6f5f4",
          foreground: "#3c3832",
        },
        muted: {
          DEFAULT: "#f5f4f3",
          foreground: "#8f8c87",
        },
        accent: {
          DEFAULT: "#f3f2f0",
          foreground: "#3c3832",
        },
        destructive: {
          DEFAULT: "#c43030",
          foreground: "#fcfbf9",
        },
        border: "#ebe9e6",
        input: "#e9e7e4",
        ring: "#7a7670",
        river: {
          DEFAULT: "#3b5dab",
          tint: "#eef2fc",
        },
        amber: {
          DEFAULT: "#c68a1f",
          tint: "#fdf6ea",
        },
        green: {
          DEFAULT: "#2a8c4d",
          tint: "#eaf8ef",
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
