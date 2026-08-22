/** Mirrors ferry/src/http/handlers/user.rs CreateUserRequest. */
export type CreateUserRequest = {
  mobile_number: string;
  name?: string;
  mascot?: string;
};

/** Mirrors ferry/src/http/handlers/user.rs CreateUserResponse. */
export type CreateUserResponse = {
  id: string;
  mobile_number: string;
  name: string;
  mascot: string;
  access_token: string;
  refresh_token: string;
};

/** Mirrors ferry/src/http/handlers/user.rs UserResponse. */
export type UserResponse = {
  id: string;
  mobile_number: string;
  name: string;
  mascot: string;
};
