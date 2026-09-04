import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Appearance, View } from "react-native";
import { vars } from "nativewind";

export type Scheme = "light" | "dark";
export type ThemePreference = Scheme | "system";

/**
 * Same semantic tokens as web/src/app/globals.css, as "r g b" triplets so
 * Tailwind's `rgb(var(--color-x) / <alpha-value>)` can still apply opacity.
 * Dark values are the web dark palette's oklch converted to sRGB.
 */
const LIGHT = {
  canvas: "245 245 245",
  background: "255 255 255",
  foreground: "60 56 50",
  card: "255 255 255",
  popover: "255 255 255",
  primary: "46 42 37",
  "primary-foreground": "252 251 249",
  secondary: "246 245 244",
  "secondary-foreground": "60 56 50",
  muted: "245 244 243",
  "muted-foreground": "143 140 135",
  accent: "243 242 240",
  "accent-foreground": "60 56 50",
  destructive: "196 48 48",
  "destructive-foreground": "252 251 249",
  border: "235 233 230",
  input: "233 231 228",
  ring: "122 118 112",
  river: "59 93 171",
  "river-tint": "238 242 252",
  amber: "198 138 31",
  "amber-tint": "253 246 234",
  green: "42 140 77",
  "green-tint": "234 248 239",
} as const;

const DARK = {
  canvas: "11 12 15",
  background: "17 19 21",
  foreground: "237 238 241",
  card: "20 21 24",
  popover: "24 25 28",
  primary: "237 238 241",
  "primary-foreground": "17 19 21",
  secondary: "31 32 35",
  "secondary-foreground": "237 238 241",
  muted: "31 32 35",
  "muted-foreground": "150 152 157",
  accent: "34 36 40",
  "accent-foreground": "237 238 241",
  destructive: "239 102 97",
  "destructive-foreground": "249 248 247",
  border: "41 43 44",
  input: "50 52 54",
  ring: "132 134 138",
  river: "122 172 246",
  "river-tint": "32 40 53",
  amber: "228 172 89",
  "amber-tint": "47 40 31",
  green: "111 200 132",
  "green-tint": "30 44 37",
} as const;

function toVars(tokens: Record<string, string>) {
  return vars(
    Object.fromEntries(
      Object.entries(tokens).map(([key, value]) => [`--color-${key}`, value]),
    ),
  );
}

const lightVars = toVars(LIGHT);
const darkVars = toVars(DARK);

/**
 * Hex equivalents of the same tokens, for the handful of call sites (icon
 * `color` props, StyleSheet.create) that can't take a className. Kept in
 * sync with LIGHT/DARK above by construction — see scripts/theme-hex.md if
 * these ever drift (they're derived from the same oklch source).
 */
export const themeColors = {
  light: {
    ink: "#3c3832",
    onInk: "#fcfbf9",
    muted: "#8f8c87",
    mutedBg: "#f5f4f3",
    faint: "#b0ada7",
    subtle: "#5c5850",
    border: "#ebe9e6",
    canvas: "#f5f5f5",
    background: "#ffffff",
    river: "#3b5dab",
    amber: "#c68a1f",
    green: "#2a8c4d",
    destructive: "#c43030",
  },
  dark: {
    ink: "#edeef1",
    onInk: "#111315",
    muted: "#96989d",
    mutedBg: "#1f2023",
    faint: "#6b6d72",
    subtle: "#c4c6ca",
    border: "#292b2c",
    canvas: "#0b0c0f",
    background: "#111315",
    river: "#7aacf6",
    amber: "#e4ac59",
    green: "#6fc884",
    destructive: "#ef6661",
  },
} as const;

export type ThemeColors = Record<keyof (typeof themeColors)["light"], string>;

type ThemeContextValue = {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  scheme: Scheme;
  colors: ThemeColors;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemScheme(): Scheme {
  return Appearance.getColorScheme() === "dark" ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>("system");
  const [system, setSystem] = useState<Scheme>(systemScheme());

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystem(colorScheme === "dark" ? "dark" : "light");
    });
    return () => sub.remove();
  }, []);

  const scheme: Scheme = preference === "system" ? system : preference;

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, setPreference, scheme, colors: themeColors[scheme] }),
    [preference, scheme],
  );

  return (
    <ThemeContext.Provider value={value}>
      <View style={[{ flex: 1 }, scheme === "dark" ? darkVars : lightVars]}>
        {children}
      </View>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}

/** Convenience for call sites that only need the current hex palette. */
export function useThemeColors() {
  return useTheme().colors;
}
