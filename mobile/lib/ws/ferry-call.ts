import InCallManager from "react-native-incall-manager";
import { DeviceEventEmitter } from "react-native";
import {
  ExpoPlayAudioStream,
  EncodingTypes,
  PlaybackModes,
  type Subscription,
} from "@mykin-ai/expo-audio-stream";

import { authHeader } from "@/lib/auth/tokens";
import { ferry } from "@/lib/ferry";
import { base64ToBytes, bytesToBase64 } from "./base64";
import {
  decodeWireMessage,
  encodeAudioMessage,
  WireMessageKind,
  type TranscriptMessage,
  type TranslationMessage,
} from "./wire";

export enum CallStatus {
  Idle = "idle",
  Connecting = "connecting",
  Connected = "connected",
  Ended = "ended",
  Error = "error",
}

export type FerryCallEvents = {
  onStatusChange: (status: CallStatus) => void;
  onTranscript: (message: TranscriptMessage) => void;
  onTranslation: (message: TranslationMessage) => void;
  onError: (message: string) => void;
};

const SAMPLE_RATE = 16_000;
/** One continuous TTS stream per call — not "turns" in the multi-response
 * sense the buffered-playback API models, so a single fixed turn id covers
 * the whole call's lifetime. */
const TURN_ID = "ferry-call";

/** How often the mic hands us a chunk of captured audio. Small enough to
 * keep latency low, large enough not to spam the socket with per-message
 * overhead. */
const MIC_CHUNK_INTERVAL_MS = 100;

export class SignalingError extends Error {}

/** RN's WebSocket constructor takes a third `options.headers` argument the
 * DOM-lib `WebSocket` type doesn't know about. */
type RNWebSocketCtor = new (
  url: string,
  protocols?: string | string[] | null,
  options?: { headers?: Record<string, string> } | null,
) => WebSocket;

/** ws(s)://<ferry host>/<path> — same host `lib/ferry.ts` talks HTTP(S) to,
 * just a different scheme, since ferry serves both off one port. */
function wsUrl(path: string, params: Record<string, string>): string {
  const httpUrl = new URL(ferry.baseUrl());
  const wsScheme = httpUrl.protocol === "https:" ? "wss:" : "ws:";
  const url = new URL(path, `${wsScheme}//${httpUrl.host}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

/**
 * Owns one call's imperative lifecycle end to end: mic capture, the
 * WebSocket connection against ferry (via `startTryAgent`'s
 * /v1/try-agent/ws or `startCall`'s /v1/call/ws), audio playback, and
 * teardown. Kept independent of React so it can't be caught up in
 * stale-closure/re-render bugs; `useFerryCall` is the thin React wrapper.
 */
export class FerryCall {
  private ws: WebSocket | null = null;
  private micSubscription: Subscription | null = null;
  private micActive = false;
  private status: CallStatus = CallStatus.Idle;
  private muted = false;
  private readonly events: FerryCallEvents;
  // A close/abort mid-connect can itself throw or fire late callbacks;
  // checked before acting on anything async so a fast tap-away (or React
  // StrictMode's mount->cleanup->mount in dev) can't resurrect a call
  // that's already being torn down.
  private aborted = false;

  constructor(events: FerryCallEvents) {
    this.events = events;
  }

  getStatus(): CallStatus {
    return this.status;
  }

  /** One-way try-agent demo — self-looped, no real PSTN leg. */
  startTryAgent(agentId: string): Promise<void> {
    return this.connect(wsUrl("/v1/try-agent/ws", { agent_id: agentId }), true);
  }

  /** A real two-leg call — ferry dials `toNumber` out over Twilio for the
   * other leg. Doesn't flip to `Connected` until ferry says the other leg
   * actually answered (`PeerConnected`), unlike the try-agent demo. */
  startCall(agentId: string, toNumber: string): Promise<void> {
    return this.connect(
      wsUrl("/v1/call/ws", { agent_id: agentId, to_number: toNumber }),
      false,
    );
  }

  private async connect(url: string, connectedOnOpen: boolean): Promise<void> {
    if (this.status === CallStatus.Connecting || this.status === CallStatus.Connected) {
      return;
    }
    this.aborted = false;
    this.setStatus(CallStatus.Connecting);

    // Activates the platform call-audio session (AudioManager on Android,
    // AVAudioSession on iOS). Best-effort: a failure here shouldn't take
    // the whole call down.
    startInCallManager(() => this.aborted);

    try {
      const permission = await ExpoPlayAudioStream.requestPermissionsAsync();
      if (!permission.granted) {
        throw new Error("Microphone permission was not granted");
      }
      if (this.aborted) {
        return;
      }

      await ExpoPlayAudioStream.setSoundConfig({
        sampleRate: SAMPLE_RATE,
        playbackMode: PlaybackModes.VOICE_PROCESSING,
      });
      await ExpoPlayAudioStream.startBufferedAudioStream({
        turnId: TURN_ID,
        encoding: EncodingTypes.PCM_S16LE,
      });
      if (this.aborted) {
        await this.teardown();
        return;
      }

      // headers here (RN's WebSocket accepts a third `options.headers`
      // argument, unlike the browser WebSocket API — see
      // react-native/Libraries/WebSocket/WebSocket.js) is what carries our
      // JWT to the WS upgrade request — same Authorization ferry's
      // `require_user` middleware reads off any other protected route. Cast
      // through `RNWebSocketCtor` since the ambient `WebSocket` type here
      // comes from lib.dom, which doesn't know about this RN-only argument.
      const ws = new (WebSocket as unknown as RNWebSocketCtor)(url, undefined, {
        headers: authHeader(),
      });
      ws.binaryType = "arraybuffer";
      this.ws = ws;

      ws.onopen = () => {
        if (this.aborted) {
          return;
        }
        if (connectedOnOpen) {
          this.setStatus(CallStatus.Connected);
          this.setSpeakerOn(true);
        }
        void this.startMic();
      };

      ws.onmessage = (event: { data: ArrayBuffer | string }) => {
        if (typeof event.data === "string") {
          console.warn("[ferry] dropping unexpected text message");
          return;
        }
        this.handleWireMessage(event.data);
      };

      ws.onerror = () => {
        if (this.aborted) {
          return;
        }
        void this.teardown();
        this.setStatus(CallStatus.Error);
        this.events.onError("Call connection failed");
      };

      ws.onclose = () => {
        if (this.aborted || this.status === CallStatus.Ended) {
          return;
        }
        void this.teardown();
        this.setStatus(CallStatus.Ended);
      };
    } catch (err) {
      if (this.aborted) {
        await this.teardown();
        return;
      }
      await this.teardown();
      this.setStatus(CallStatus.Error);
      this.events.onError(
        err instanceof SignalingError || err instanceof Error
          ? err.message
          : "Failed to start call",
      );
    }
  }

  private async startMic(): Promise<void> {
    if (this.aborted || this.micActive) {
      return;
    }
    this.micActive = true;
    try {
      const { subscription } = await ExpoPlayAudioStream.startMicrophone({
        sampleRate: SAMPLE_RATE,
        channels: 1,
        encoding: "pcm_16bit",
        interval: MIC_CHUNK_INTERVAL_MS,
        enableProcessing: true,
        onAudioStream: async (event) => {
          if (this.muted || typeof event.data !== "string") {
            return;
          }
          const pcm = base64ToBytes(event.data);
          this.ws?.send(encodeAudioMessage(pcm).buffer);
        },
      });
      this.micSubscription = subscription ?? null;
    } catch (e) {
      console.warn("[ferry] failed to start microphone:", e);
    }
  }

  private handleWireMessage(data: ArrayBuffer): void {
    const message = decodeWireMessage(data);
    switch (message.kind) {
      case WireMessageKind.Audio:
        void ExpoPlayAudioStream.playAudioBuffered(
          bytesToBase64(message.audio),
          TURN_ID,
        ).catch((e) => console.warn("[ferry] playback failed:", e));
        break;
      case WireMessageKind.Transcript:
        this.events.onTranscript(message.transcript);
        break;
      case WireMessageKind.Translation:
        this.events.onTranslation(message.translation);
        break;
      case WireMessageKind.PeerConnected:
        this.setStatus(CallStatus.Connected);
        this.setSpeakerOn(true);
        break;
      case WireMessageKind.CallRinging:
        // No distinct "ringing" UI state today — same no-op the old
        // WebRTC data-channel path had for this tag.
        break;
      case WireMessageKind.CallEnded:
        void this.teardown();
        this.setStatus(CallStatus.Ended);
        break;
      case WireMessageKind.Unknown:
        console.warn("[ferry] unknown wire tag:", message.tag);
        break;
    }
  }

  /** Mutes/unmutes the mic locally — doesn't touch the connection. */
  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  /** Routes call audio to the loudspeaker (true) or the earpiece (false). */
  setSpeakerOn(enabled: boolean): void {
    try {
      InCallManager.setForceSpeakerphoneOn(enabled);
    } catch (e) {
      console.warn("[ferry] InCallManager.setForceSpeakerphoneOn failed:", e);
    }
  }

  end(): void {
    this.aborted = true;
    void this.teardown();
    this.setStatus(CallStatus.Ended);
  }

  private setStatus(status: CallStatus): void {
    this.status = status;
    this.events.onStatusChange(status);
  }

  private async teardown(): Promise<void> {
    try {
      InCallManager.stop();
    } catch (e) {
      console.warn("[ferry] InCallManager.stop failed:", e);
    }
    this.ws?.close();
    this.ws = null;
    if (this.micActive) {
      this.micActive = false;
      try {
        await ExpoPlayAudioStream.stopMicrophone();
      } catch (e) {
        console.warn("[ferry] stopMicrophone failed:", e);
      }
    }
    this.micSubscription?.remove();
    this.micSubscription = null;
    try {
      await ExpoPlayAudioStream.stopBufferedAudioStream(TURN_ID);
    } catch (e) {
      console.warn("[ferry] stopBufferedAudioStream failed:", e);
    }
  }
}

// react-native-incall-manager builds its list of available audio routes
// (audioDevices) asynchronously, on the native UI thread, via its own
// internal updateAudioDeviceState() — start() only *schedules* that, it
// doesn't wait for it. Calling setForceSpeakerphoneOn() immediately after
// start() races that: if the device list is still empty when it runs, the
// library's own guard (`if (!audioDevices.contains(device)) return;`)
// silently rejects the request and falls back to its own default (earpiece
// for a plain audio call) — confirmed via `adb logcat`:
// "selectAudioDevice() Can not select SPEAKER_PHONE from available []".
//
// Rather than guessing how long that takes, wait for the real signal: the
// native module emits "onAudioDeviceChanged" (with the current device
// list) every time it updates its state, including right after start().
// We only force speakerphone once SPEAKER_PHONE actually shows up in that
// list. A timeout is kept as a safety net in case the event never fires
// (e.g. a library/platform variant without it) — without one, a stalled
// event would leave the call silently stuck on whatever default route it
// picked, with the user never told why.
const SPEAKER_WAIT_TIMEOUT_MS = 2_000;

type AudioDeviceChangedEvent = { availableAudioDeviceList?: string };

function waitForSpeakerAvailable(timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) {
        return;
      }
      done = true;
      subscription.remove();
      clearTimeout(timeout);
      resolve();
    };

    const subscription = DeviceEventEmitter.addListener(
      "onAudioDeviceChanged",
      (event: AudioDeviceChangedEvent) => {
        try {
          const devices: string[] = event.availableAudioDeviceList
            ? JSON.parse(event.availableAudioDeviceList)
            : [];
          if (devices.includes("SPEAKER_PHONE")) {
            finish();
          }
        } catch (e) {
          console.warn("[ferry] failed to parse onAudioDeviceChanged payload:", e);
        }
      },
    );

    const timeout = setTimeout(finish, timeoutMs);
  });
}

function startInCallManager(isAborted: () => boolean): void {
  try {
    InCallManager.start({ media: "audio" });
    // Default to loudspeaker rather than earpiece — this is a translation
    // agent you talk *through*, not a private phone call, and earpiece
    // routing is exactly what made audio inaudible before this was added.
    waitForSpeakerAvailable(SPEAKER_WAIT_TIMEOUT_MS).then(() => {
      if (isAborted()) {
        return;
      }
      try {
        InCallManager.setForceSpeakerphoneOn(true);
      } catch (e) {
        console.warn("[ferry] InCallManager.setForceSpeakerphoneOn failed:", e);
      }
    });
  } catch (e) {
    console.warn("[ferry] InCallManager.start failed:", e);
  }
}
