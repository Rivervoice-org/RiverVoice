import type { Metadata } from "next";
import { Geist_Mono, Inter, Newsreader } from "next/font/google";
import { QueryProvider } from "@/components/query-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toast";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["300", "400", "500"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Pages set their own title; this appends the product name to it.
  title: {
    default: "Rivervoice",
    template: "%s · Rivervoice",
  },
  description: "Voice agents that answer the phone.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      // next-themes sets the class before paint, which the server cannot know
      suppressHydrationWarning
      className={`${inter.variable} ${newsreader.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* Extensions add their own attributes to <body> before React loads,
          which otherwise reports as a hydration mismatch. */}
      <body suppressHydrationWarning className="flex min-h-full flex-col">
        <QueryProvider>
          <ThemeProvider>
            {/* Before the app, not after: the manager drops anything emitted
                while nothing is subscribed, and sibling effects run in tree
                order — so a toast raised on mount needs this listening first. */}
            <Toaster />
            {children}
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
