/**
 * Self-contained base64 <-> bytes conversion — `ExpoPlayAudioStream`'s API
 * is base64-native (mic chunks arrive as base64, `playAudioBuffered` wants
 * base64 in), while the WebSocket wire protocol is raw tagged binary
 * (mirrors `ferry/src/codec/transport/mobile_ws.rs`). Written by hand
 * rather than relying on `atob`/`btoa` (inconsistent availability across
 * Hermes versions) or a `Buffer` polyfill (not guaranteed present in RN).
 */

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function bytesToBase64(bytes: Uint8Array): string {
  let result = "";
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const chunk = (bytes[i]! << 16) | (bytes[i + 1]! << 8) | bytes[i + 2]!;
    result += CHARS[(chunk >> 18) & 0x3f];
    result += CHARS[(chunk >> 12) & 0x3f];
    result += CHARS[(chunk >> 6) & 0x3f];
    result += CHARS[chunk & 0x3f];
  }
  const remaining = bytes.length - i;
  if (remaining === 1) {
    const chunk = bytes[i]! << 16;
    result += CHARS[(chunk >> 18) & 0x3f];
    result += CHARS[(chunk >> 12) & 0x3f];
    result += "==";
  } else if (remaining === 2) {
    const chunk = (bytes[i]! << 16) | (bytes[i + 1]! << 8);
    result += CHARS[(chunk >> 18) & 0x3f];
    result += CHARS[(chunk >> 12) & 0x3f];
    result += CHARS[(chunk >> 6) & 0x3f];
    result += "=";
  }
  return result;
}

const REVERSE: Record<string, number> = Object.fromEntries(
  [...CHARS].map((c, i) => [c, i]),
);

export function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/=+$/, "");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let outIdx = 0;
  let buffer = 0;
  let bits = 0;
  for (const char of clean) {
    const value = REVERSE[char];
    if (value === undefined) {
      continue;
    }
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[outIdx++] = (buffer >> bits) & 0xff;
    }
  }
  return out.subarray(0, outIdx);
}
