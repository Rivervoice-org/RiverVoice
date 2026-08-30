// supabase-js expects `URL` to behave like a browser's — this polyfill has
// to run before the client is constructed, or auth/storage requests built
// internally from URLs silently misbehave on React Native's JS engine.
import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { config } from "@/lib/config";

/**
 * One shared client for everything Supabase — auth (Google ID-token
 * sign-in, session refresh) and, later, direct PostgREST access for
 * plain-CRUD tables like `agents`/`calls`. `AsyncStorage`, not
 * `expo-secure-store`:
 * Supabase persists the whole session object (access + refresh token plus
 * metadata) as one blob, which routinely exceeds SecureStore's per-item
 * size limit on Android — this is what Supabase's own React Native guide
 * recommends. `autoRefreshToken` means nothing here has to replicate
 * ferry.ts's old manual 401-retry-refresh dance for auth itself.
 */
export const supabase = createClient(
  config.supabaseUrl,
  config.supabaseAnonKey,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

/**
 * The signed-in user's id, for scoping a direct PostgREST query to "mine" —
 * `getSession()` reads the client's already-restored/refreshed session
 * locally (no network round trip), unlike `getUser()` which re-validates
 * against Supabase on every call. Throws rather than returning null: every
 * call site is behind a screen that already requires auth, so a missing
 * session here means something upstream let a signed-out request through.
 */
export async function currentUserId(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("Not signed in");
  }
  return session.user.id;
}
