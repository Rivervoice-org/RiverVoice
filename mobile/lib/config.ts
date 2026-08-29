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
});

// Expo's env-var inlining only statically replaces literal dot-notation
// `process.env.EXPO_PUBLIC_*` member expressions — bracket notation isn't
// matched and would silently stay undefined in a release build. That's
// incompatible with this project's noPropertyAccessFromIndexSignature, so
// each access is suppressed individually rather than disabling the rule
// project-wide.
const parsed = envSchema.safeParse({
  // @ts-expect-error -- dot notation required for Expo's env inlining
  EXPO_PUBLIC_FERRY_URL: process.env.EXPO_PUBLIC_FERRY_URL,
  // @ts-expect-error -- dot notation required for Expo's env inlining
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
});

if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
}

export const config = {
  ferryUrl: parsed.data.EXPO_PUBLIC_FERRY_URL,
  googleWebClientId: parsed.data.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
};
