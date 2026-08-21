/**
 * Try-agent WebRTC call, signaling against ferry's `/v1/try-agent/offer`
 * (see ferry/src/http/handlers/webrtc.rs webrtc_offer — the one-way,
 * self-looped STT->MT->TTS demo, no call registry/Twilio involved). The
 * actual WebRTC transport lives in ./webrtc/rtc-connection.ts, shared with
 * phone-call.ts.
 */

import {
  connectFerryCall,
  BrowserVoiceStatus,
  BrowserVoiceError,
  BrowserVoiceErrorCode,
  type BrowserVoiceCall,
  type ConnectOptions,
} from "./webrtc/rtc-connection";

export { BrowserVoiceStatus, BrowserVoiceError, BrowserVoiceErrorCode };
export type { BrowserVoiceCall };

export type BrowserVoiceOptions = Omit<ConnectOptions, "signalingUrl">;

const FERRY_URL = process.env.NEXT_PUBLIC_FERRY_URL ?? "ws://localhost:8085";

function toHttpUrl(wsUrl: string): string {
  return wsUrl.replace(/^ws/, "http");
}

async function start(options: BrowserVoiceOptions): Promise<BrowserVoiceCall> {
  return connectFerryCall({
    ...options,
    signalingUrl: `${toHttpUrl(FERRY_URL)}/v1/try-agent/offer`,
  });
}

export const BrowserVoice = { start };
