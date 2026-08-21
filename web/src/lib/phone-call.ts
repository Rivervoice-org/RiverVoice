/**
 * Two-leg WebRTC call, signaling against ferry's `/v1/call/start`
 * (see ferry/src/http/handlers/call.rs start_call): the browser becomes leg
 * A, and ferry dials leg B out to whatever number `TWILIO_TO_NUMBER` is
 * configured to — no dial number is sent from here, ferry doesn't accept
 * one yet. The actual WebRTC transport lives in ./webrtc/rtc-connection.ts,
 * shared with browser-voice.ts.
 *
 * `BrowserVoiceStatus.Live` reflects only the browser's own WebRTC
 * connection to ferry, which comes up well before Twilio's dial resolves —
 * it is not "leg B (the phone) actually answered". For that, use
 * `onRinging` (fires when ferry's internal `CallStatus` flips to `Ringing`)
 * and `onPeerConnected` (fires once leg B actually picks up), both sent by
 * ferry as data-channel control bytes and decoded in ./webrtc/wire.ts.
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

export type PhoneCallOptions = Omit<ConnectOptions, "signalingUrl">;

const FERRY_URL = process.env.NEXT_PUBLIC_FERRY_URL ?? "ws://localhost:8085";

function toHttpUrl(wsUrl: string): string {
  return wsUrl.replace(/^ws/, "http");
}

async function start(options: PhoneCallOptions): Promise<BrowserVoiceCall> {
  return connectFerryCall({
    ...options,
    signalingUrl: `${toHttpUrl(FERRY_URL)}/v1/call/start`,
  });
}

export const PhoneCall = { start };
