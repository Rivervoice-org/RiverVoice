/** Mirrors ferry/src/http/handlers/user.rs GoogleSignInRequest. */
export type GoogleSignInRequest = {
  id_token: string;
};

/** Mirrors ferry/src/http/handlers/user.rs GoogleSignInResponse. */
export type GoogleSignInResponse = {
  id: string;
  email: string;
  name: string;
  mascot: string;
  access_token: string;
  refresh_token: string;
};

/** Mirrors ferry/src/http/handlers/user.rs UserResponse. */
export type UserResponse = {
  id: string;
  email: string;
  name: string;
  mascot: string;
};
