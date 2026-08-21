import * as SecureStore from "expo-secure-store";

const REFRESH_TOKEN_KEY = "rv_refresh_token";

/**
 * The access token only ever lives in memory — it's short-lived (15 min,
 * see ferry's ACCESS_TOKEN_TTL_MINUTES) and re-derived from the refresh
 * token on app launch, so there's no need to persist it. The refresh token
 * goes in SecureStore (iOS Keychain / Android Keystore), never
 * AsyncStorage — that's plaintext on disk.
 */
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function saveTokens(tokens: {
  access_token: string;
  refresh_token: string;
}): Promise<void> {
  accessToken = tokens.access_token;
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refresh_token);
}

export async function clearTokens(): Promise<void> {
  accessToken = null;
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}
