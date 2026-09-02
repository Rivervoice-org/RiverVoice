import { z } from "zod";

const DEFAULT_FERRY_URL = "http://127.0.0.1:8085";

enum Environment {
  Dev = "development",
  Prod = "production",
}

function environment(): Environment {
  // @ts-expect-error -- dot notation required for Expo's env inlining
  const raw = process.env.EXPO_PUBLIC_ENVIRONMENT;
  return raw === Environment.Prod ? Environment.Prod : Environment.Dev;
}

/**
 * All `EXPO_PUBLIC_*` env vars the app reads, validated once at import time
 * so a missing/malformed value fails loudly on launch instead of surfacing
 * later as a confusing runtime error (e.g. Google Sign-In rejecting every
 * attempt because `webClientId` was `undefined`).
 */
const envSchema = z.object({
  GOOGLE_WEB_CLIENT_ID: z.string().min(1, "GOOGLE_WEB_CLIENT_ID is not set"),
  FERRY_URL: z.string().url().default(DEFAULT_FERRY_URL),
  // Kong's gateway address, not any individual Supabase service directly —
  // same tunnel/LAN-IP pattern as FERRY_URL.
  SUPABASE_URL: z.string().url().min(1, "SUPABASE_URL is not set"),
  // Publishable key (sb_publishable_...) — new Supabase API key, safe to ship
  // client-side, RLS is what restricts it. Replaces legacy anon key.
  SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(1, "SUPABASE_PUBLISHABLE_KEY is not set"),
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
//
// GOOGLE_WEB_CLIENT_ID is the same OAuth client for both environments, so
// it isn't split into _DEV/_PROD variants like the rest below.
// @ts-expect-error -- dot notation required for Expo's env inlining
const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

// @ts-expect-error -- dot notation required for Expo's env inlining
const ferryUrlDev = process.env.EXPO_PUBLIC_FERRY_URL_DEV;
// @ts-expect-error -- dot notation required for Expo's env inlining
const ferryUrlProd = process.env.EXPO_PUBLIC_FERRY_URL_PROD;
// @ts-expect-error -- dot notation required for Expo's env inlining
const supabaseUrlDev = process.env.EXPO_PUBLIC_SUPABASE_URL_DEV;
// @ts-expect-error -- dot notation required for Expo's env inlining
const supabaseUrlProd = process.env.EXPO_PUBLIC_SUPABASE_URL_PROD;
// @ts-expect-error -- dot notation required for Expo's env inlining
const supabasePublishableKeyDev =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY_DEV;
// @ts-expect-error -- dot notation required for Expo's env inlining
const supabasePublishableKeyProd =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY_PROD;

const isProd = environment() === Environment.Prod;

const parsed = envSchema.safeParse({
  GOOGLE_WEB_CLIENT_ID: googleWebClientId,
  FERRY_URL: isProd ? ferryUrlProd : ferryUrlDev,
  SUPABASE_URL: isProd ? supabaseUrlProd : supabaseUrlDev,
  SUPABASE_PUBLISHABLE_KEY: isProd
    ? supabasePublishableKeyProd
    : supabasePublishableKeyDev,
});

if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
}

export const config = {
  ferryUrl: parsed.data.FERRY_URL,
  googleWebClientId: parsed.data.GOOGLE_WEB_CLIENT_ID,
  supabaseUrl: parsed.data.SUPABASE_URL,
  supabasePublishableKey: parsed.data.SUPABASE_PUBLISHABLE_KEY,
};
