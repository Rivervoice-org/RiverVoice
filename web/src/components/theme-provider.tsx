"use client";

import { ThemeProvider as NextThemes } from "next-themes";

/** Puts .dark on <html>, remembers the choice, and follows the OS by default. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemes>
  );
}
