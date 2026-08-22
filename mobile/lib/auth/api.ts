import { authHeader } from "@/lib/auth/tokens";
import { ferry } from "@/lib/ferry";
import type { CreateUserRequest, CreateUserResponse, UserResponse } from "@/lib/auth/types";

/**
 * Hits ferry's `POST /v1/users` (see ferry/src/http/handlers/user.rs).
 * There is no separate OTP/login endpoint yet — this is the one auth
 * route ferry exposes, and it creates the user if the number is new.
 */
export function createUser(payload: CreateUserRequest): Promise<CreateUserResponse> {
  return ferry.post<CreateUserResponse>("/v1/users", payload);
}

/**
 * Hits ferry's `GET /v1/users/me`. Protected — resolves the caller from
 * their access token, not anything the client claims. The source of truth
 * for the signed-in user's profile; never cache this locally as a
 * substitute for calling it.
 */
export function getMe(): Promise<UserResponse> {
  return ferry.get<UserResponse>("/v1/users/me", authHeader());
}

/**
 * Hits ferry's `POST /v1/auth/signout` — revokes the refresh token's whole
 * family server-side, so it can't be redeemed again even if it leaks after
 * the client discards it. Public route: it authenticates via the refresh
 * token in the body, not a Bearer access token.
 */
export function signOutRequest(refreshToken: string): Promise<null> {
  return ferry.post<null>("/v1/auth/signout", { refresh_token: refreshToken });
}
