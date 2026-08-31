import { z } from "zod";

const DEFAULT_FERRY_URL = "http://127.0.0.1:8085";

/**
 * All `EXPO_PUBLIC_*` env vars the app reads, validated once at import time
 * so a missing/malformed value fails loudly on launch instead of surfacing
 * later as a confusing runtime error (e.g. Google Sign-In rejecting every
 * attempt because `webClientId` was `undefined`).
 */
const envSchema = z.object({
  EXPO_PUBLIC_FERRY_URL: z.string().url().default(DEFAULT_FERRY_URL),
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: z
    .string()
    .min(1, "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not set"),
  // Kong's gateway address, not any individual Supabase service directly —
  // same tunnel/LAN-IP pattern as EXPO_PUBLIC_FERRY_URL.
  EXPO_PUBLIC_SUPABASE_URL: z
    .string()
    .url()
    .min(1, "EXPO_PUBLIC_SUPABASE_URL is not set"),
  // The anon key, safe to ship in the client — RLS is what actually
  // restricts what it can do, not secrecy of this value.
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, "EXPO_PUBLIC_SUPABASE_ANON_KEY is not set"),
});

// Expo's env-var inlining only statically replaces literal dot-notation
// `process.env.EXPO_PUBLIC_*` member expressions — bracket notation isn't
// matched and would silently stay undefined in a release build. That's
// incompatible with this project's noPropertyAccessFromIndexSignature, so
// each access is suppressed individually rather than disabling the rule
// project-wide. Pulled into their own short consts (rather than inline in
// the object below) so a `@ts-expect-error` line always stays directly
// above the expression it's suppressing, even if prettier rewraps the
// object literal.
// @ts-expect-error -- dot notation required for Expo's env inlining
const ferryUrl = process.env.EXPO_PUBLIC_FERRY_URL;
// @ts-expect-error -- dot notation required for Expo's env inlining
const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
// @ts-expect-error -- dot notation required for Expo's env inlining
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
// @ts-expect-error -- dot notation required for Expo's env inlining
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const parsed = envSchema.safeParse({
  EXPO_PUBLIC_FERRY_URL: ferryUrl,
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: googleWebClientId,
  EXPO_PUBLIC_SUPABASE_URL: supabaseUrl,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey,
});

if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
}

export const config = {
  ferryUrl: parsed.data.EXPO_PUBLIC_FERRY_URL,
  googleWebClientId: parsed.data.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  supabaseUrl: parsed.data.EXPO_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: parsed.data.EXPO_PUBLIC_SUPABASE_ANON_KEY,
};
