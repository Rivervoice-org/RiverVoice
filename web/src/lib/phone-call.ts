/**
 * Two-leg WebRTC call, signaling against ferry's `/v1/call/start`
 * (see ferry/src/http/handlers/call.rs start_call): the browser becomes leg
 * A, and ferry dials leg B out to whatever number `TWILIO_TO_NUMBER` is
 * configured to — no dial number is sent from here, ferry doesn't accept
 * one yet. The actual WebRTC transport lives in ./webrtc/rtc-connection.ts,
 * shared with browser-voice.ts.
 *
 * NOTE: there is currently no signal from ferry distinguishing "leg A
 * connected to ferry" from "leg B (the phone) actually answered" — the
 * status here goes Live as soon as the browser's own WebRTC connection to
 * ferry is up, which can be well before Twilio's dial resolves. Ferry would
 * need to push a control message over the data channel once its internal
 * `CallStatus` flips to `Connected` for this to reflect the real PSTN
 * pickup — not done here since it requires a ferry change.
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
