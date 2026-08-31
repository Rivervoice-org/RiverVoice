/**
 * Talking to ferry directly (mobile calls ferry directly, no web
 * intermediary — see lib/webrtc/signaling.ts for the same pattern applied
 * to the WebRTC offer/answer exchange, which has its own error type and
 * doesn't go through this client).
 */

import type { ApiResponse } from "@/lib/api-types";
import { authHeader } from "@/lib/auth/tokens";
import { config } from "@/lib/config";
import { supabase } from "@/lib/supabase";

const REQUEST_TIMEOUT_MS = 15_000;

export class FerryApiError extends Error {
  /** The response's HTTP status, or undefined for a network/timeout failure. */
  status?: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

class FerryClient {
  baseUrl(): string {
    return config.ferryUrl;
  }

  /** The actual network call — no 401/refresh handling, so refreshTokens()
   * can use this without recursing into itself. */
  private async rawRequest<T>(path: string, init: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl()}${path}`, {
        ...init,
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
      throw new FerryApiError(
        parsed.error?.message ?? `Server returned ${response.status}`,
        response.status,
      );
    }
    if (parsed.data === undefined) {
      throw new FerryApiError("Server returned no data", response.status);
    }

    return parsed.data;
  }

  /**
   * Runs a request; on a 401 from a request that actually carried an
   * Authorization header (i.e. a protected route, not a public one),
   * forces Supabase to check/refresh the session once and retries with
   * whatever token comes out of that. Supabase's client already refreshes
   * proactively before expiry (see lib/supabase.ts's autoRefreshToken), so
   * a 401 here should only ever be the rare in-flight-at-expiry race — not
   * something that needs the repeated-backoff retries the old ferry-issued
   * refresh token required.
   */
  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const isAuthed =
      (init.headers as Record<string, string> | undefined)?.[
        "Authorization"
      ] !== undefined;

    try {
      return await this.rawRequest<T>(path, init);
    } catch (err) {
      const canRetry =
        isAuthed && err instanceof FerryApiError && err.status === 401;
      if (!canRetry) {
        throw err;
      }

      await supabase.auth.getSession();
      const retryInit = {
        ...init,
        headers: { ...init.headers, ...authHeader() },
      };
      return this.rawRequest<T>(path, retryInit);
    }
  }

  /** GETs a ferry route and unwraps ferry's `{ data, error }` envelope. */
  get<T>(path: string, headers?: Record<string, string>): Promise<T> {
    // `RequestInit.headers` (a DOM type) rejects an explicit `undefined`
    // under `exactOptionalPropertyTypes` — omit the key entirely rather
    // than set it to a possibly-undefined value.
    return this.request<T>(path, {
      method: "GET",
      ...(headers ? { headers } : {}),
    });
  }

  /** POSTs JSON to a ferry route and unwraps ferry's `{ data, error }` envelope. */
  post<T>(
    path: string,
    body: unknown,
    headers?: Record<string, string>,
  ): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  }

  /** PATCHes JSON to a ferry route and unwraps ferry's `{ data, error }` envelope. */
  patch<T>(
    path: string,
    body: unknown,
    headers?: Record<string, string>,
  ): Promise<T> {
    return this.request<T>(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  }

  /** DELETEs a ferry route and unwraps ferry's `{ data, error }` envelope. */
  delete<T>(path: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(path, {
      method: "DELETE",
      ...(headers ? { headers } : {}),
    });
  }
}

/** One shared client — no per-call setup, just `ferry.get(...)` / `ferry.post(...)`. */
export const ferry = new FerryClient();
