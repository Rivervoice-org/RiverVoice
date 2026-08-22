import { ferry } from "@/lib/ferry";
import type { CreateUserRequest, CreateUserResponse } from "@/lib/auth/types";

/**
 * Hits ferry's `POST /v1/users` (see ferry/src/http/handlers/user.rs).
 * There is no separate OTP/login endpoint yet — this is the one auth
 * route ferry exposes, and it creates the user if the number is new.
 */
export function createUser(payload: CreateUserRequest): Promise<CreateUserResponse> {
  return ferry.post<CreateUserResponse>("/v1/users", payload);
}
