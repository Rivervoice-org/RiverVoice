import { config } from "@/lib/config";
import { supabase } from "@/lib/supabase";

const RECORDINGS_BUCKET = "recordings";

/**
 * Builds a playable source for a recording path (`{call_id}/original.wav`,
 * as stored in `calls.recording_path`/`translated_recording_path`) that hits
 * Storage's `authenticated` download route directly with this session's own
 * JWT — Storage re-checks the `recordings_owner_select` RLS policy on every
 * request this way, instead of a signed URL that, once minted, would work
 * for anyone holding the link regardless of who they are.
 */
export async function recordingSource(
  path: string,
): Promise<{ uri: string; headers: Record<string, string> }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("Not signed in");
  }
  return {
    uri: `${config.supabaseUrl}/storage/v1/object/authenticated/${RECORDINGS_BUCKET}/${path}`,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      // Kong's key-auth on storage-v1 checks this — separate from the
      // Authorization header above, which is what Storage itself uses to
      // resolve auth.uid() for the RLS check. Same publishable key the app
      // already ships with (EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY), not a secret.
      apikey: config.supabasePublishableKey,
    },
  };
}
