/**
 * Base fetch plumbing for talking to ferry directly (mobile calls ferry
 * directly, no web/harbor intermediary — see lib/webrtc/signaling.ts for
 * the same pattern applied to the WebRTC offer/answer exchange).
 */

import type { ApiResponse } from "@/lib/api-types";

const DEFAULT_FERRY_URL = "http://127.0.0.1:8085";

export function ferryBaseUrl(): string {
  return process.env["EXPO_PUBLIC_FERRY_URL"] ?? DEFAULT_FERRY_URL;
}

const REQUEST_TIMEOUT_MS = 15_000;

export class FerryApiError extends Error {}

/** POSTs JSON to a ferry route and unwraps ferry's `{ data, error }` envelope. */
export async function ferryPost<T>(path: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${ferryBaseUrl()}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new FerryApiError("Timed out reaching the server");
    }
    throw new FerryApiError(
      `Could not reach the server: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    clearTimeout(timeout);
  }

  const parsed = (await response.json()) as ApiResponse<T>;

  if (!response.ok || parsed.error) {
    throw new FerryApiError(parsed.error?.message ?? `Server returned ${response.status}`);
  }
  if (parsed.data === undefined) {
    throw new FerryApiError("Server returned no data");
  }

  return parsed.data;
}
