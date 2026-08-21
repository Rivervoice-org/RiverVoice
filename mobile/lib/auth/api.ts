import { ferryPost } from "@/lib/ferry";
import type { CreateUserRequest, CreateUserResponse } from "@/lib/auth/types";

/**
 * Hits ferry's `POST /v1/users` (see ferry/src/http/handlers/user.rs).
 * There is no separate OTP/login endpoint yet — this is the one auth
 * route ferry exposes right now, so both sign-in and sign-up call it
 * during this testing phase.
 */
export function createUser(payload: CreateUserRequest): Promise<CreateUserResponse> {
  return ferryPost<CreateUserResponse>("/v1/users", payload);
}
