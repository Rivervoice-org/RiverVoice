const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export type APIResponse<T> = {
  statusCode: number;
  data?: T;
  error?: { message: string };
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      // After the spread, or a caller passing headers would drop the type.
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError("Could not reach the server", 0);
  }

  const body: APIResponse<T> | null = await response.json().catch(() => null);

  if (!response.ok || body?.error) {
    throw new ApiError(body?.error?.message ?? "Something went wrong", response.status);
  }

  return body?.data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { credentials: "include" }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      credentials: "include",
      body: JSON.stringify(body ?? {}),
    }),
};
