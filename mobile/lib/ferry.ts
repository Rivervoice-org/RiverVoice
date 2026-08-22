/**
 * Talking to ferry directly (mobile calls ferry directly, no web
 * intermediary — see lib/webrtc/signaling.ts for the same pattern applied
 * to the WebRTC offer/answer exchange, which has its own error type and
 * doesn't go through this client).
 */

import type { ApiResponse } from "@/lib/api-types";
import { authHeader, clearTokens, getRefreshToken, saveTokens } from "@/lib/auth/tokens";

const DEFAULT_FERRY_URL = "http://127.0.0.1:8085";
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_AUTH_RETRIES = 3;
const AUTH_RETRY_BASE_DELAY_MS = 300;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class FerryApiError extends Error {
  /** The response's HTTP status, or undefined for a network/timeout failure. */
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

class FerryClient {
  /** Dedupes concurrent refreshes — two 401s at once should trigger one
   * refresh call, with the second request just waiting on the first. */
  private refreshPromise: Promise<void> | null = null;

  baseUrl(): string {
    return process.env["EXPO_PUBLIC_FERRY_URL"] ?? DEFAULT_FERRY_URL;
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

  /** Exchanges the stored refresh token for a new access + refresh pair. */
  private async refreshTokens(): Promise<void> {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) {
      await clearTokens();
      throw new FerryApiError("Not signed in", 401);
    }

    try {
      const result = await this.rawRequest<{ access_token: string; refresh_token: string }>(
        "/v1/auth/refresh",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        },
      );
      await saveTokens(result);
    } catch (err) {
      // The refresh token itself is invalid/expired/revoked — nothing left
      // to try. Clear it so the app doesn't keep presenting a dead token.
      await clearTokens();
      throw err;
    }
  }

  private ensureRefreshed(): Promise<void> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.refreshTokens().finally(() => {
        this.refreshPromise = null;
      });
    }
    return this.refreshPromise;
  }

  /**
   * Runs a request; on a 401 from a request that actually carried an
   * Authorization header (i.e. a protected route, not signup/login
   * themselves), refreshes the token pair and retries, up to
   * MAX_AUTH_RETRIES times with exponential backoff between attempts.
   * Any other failure — a non-401, or the refresh itself failing —
   * propagates immediately without waiting out the remaining attempts.
   */
  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const isAuthed = (init.headers as Record<string, string> | undefined)?.["Authorization"] !== undefined;
    let currentInit = init;

    for (let attempt = 0; ; attempt++) {
      try {
        return await this.rawRequest<T>(path, currentInit);
      } catch (err) {
        const canRetry = isAuthed && attempt < MAX_AUTH_RETRIES && err instanceof FerryApiError && err.status === 401;
        if (!canRetry) {
          throw err;
        }

        await sleep(AUTH_RETRY_BASE_DELAY_MS * 2 ** attempt);
        await this.ensureRefreshed();
        currentInit = { ...currentInit, headers: { ...currentInit.headers, ...authHeader() } };
      }
    }
  }

  /** GETs a ferry route and unwraps ferry's `{ data, error }` envelope. */
  get<T>(path: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(path, { method: "GET", headers });
  }

  /** POSTs JSON to a ferry route and unwraps ferry's `{ data, error }` envelope. */
  post<T>(path: string, body: unknown, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  }

  /** PATCHes JSON to a ferry route and unwraps ferry's `{ data, error }` envelope. */
  patch<T>(path: string, body: unknown, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  }

  /** DELETEs a ferry route and unwraps ferry's `{ data, error }` envelope. */
  delete<T>(path: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(path, { method: "DELETE", headers });
  }
}

/** One shared client — no per-call setup, just `ferry.get(...)` / `ferry.post(...)`. */
export const ferry = new FerryClient();
