import InCallManager from "react-native-incall-manager";
import { DeviceEventEmitter } from "react-native";
import {
  type MediaStream,
  RTCPeerConnection,
  RTCSessionDescription,
  mediaDevices,
} from "react-native-webrtc";

import { postCallOffer, postTryAgentOffer, SignalingError } from "./signaling";
import {
  decodeWireMessage,
  WireMessageKind,
  type TranscriptMessage,
  type TranslationMessage,
} from "./wire";

export enum CallStatus {
  Idle = "idle",
  Connecting = "connecting",
  // Only reachable on a real two-leg `startCall` (ferry forwards this from
  // Twilio reporting the callee's phone actively ringing) — `startTryAgent`
  // has no other leg to ring, so it goes straight from Connecting to
  // Connected.
  Ringing = "ringing",
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

// Server-side signaling is non-trickle (ferry/src/transport/webrtc/transport.rs
// waits for full ICE gathering before answering), so we mirror that here rather
// than trickling candidates over a channel that doesn't exist yet. Capped so a
// stalled candidate gatherer can't hang the call indefinitely — we send
// whatever candidates we have after the timeout.
const ICE_GATHERING_TIMEOUT_MS = 5_000;

/**
 * Owns one WebRTC call's imperative lifecycle end to end: mic capture,
 * signaling against ferry (via `startTryAgent`'s /v1/try-agent/offer or
 * `startCall`'s /v1/call/start — see signaling.ts), the data channel
 * (transcripts only — audio is a real Opus track in both directions,
 * negotiated by the server), and teardown. Kept independent of React so it
 * can't be caught up in stale-closure/re-render bugs; `useFerryCall` is the
 * thin React wrapper.
 */
export class FerryCall {
  private pc: RTCPeerConnection | null = null;
  private dataChannel: ReturnType<RTCPeerConnection["createDataChannel"]> | null = null;
  private localStream: MediaStream | null = null;
  private status: CallStatus = CallStatus.Idle;
  private readonly events: FerryCallEvents;
  // `start()` is async and spans several await points (getUserMedia, ICE
  // gathering, signaling). If `end()` is called while one of those is still
  // in flight — e.g. React StrictMode's mount→cleanup→mount in dev, or just
  // a fast tap-away in production — the in-flight call has no way to notice
  // on its own; without this it finishes connecting anyway, orphaned, with
  // no reference left to ever end it. Checked after every await below.
  private aborted = false;
  // `startCall` dials a real second leg over Twilio, which sends
  // PEER_CONNECTED_TAG/CALL_RINGING_TAG once ferry knows the callee's
  // ringing/pickup state — those drive `Ringing`/`Connected` for that flow.
  // `startTryAgent` is self-looped with no such leg and no registry entry,
  // so ferry never sends either tag for it; this flag tells
  // `pc.onconnectionstatechange` whether to fall back to WebRTC's own
  // "connected" transport state to mean `CallStatus.Connected` instead.
  private hasRealCallee = false;

  constructor(events: FerryCallEvents) {
    this.events = events;
  }

  getStatus(): CallStatus {
    return this.status;
  }

  /** One-way try-agent demo — self-looped, no real PSTN leg. */
  startTryAgent(agentId: string): Promise<void> {
    this.hasRealCallee = false;
    return this.negotiate((sdp) => postTryAgentOffer(sdp, agentId));
  }

  /** A real two-leg call — ferry dials `toNumber` out over Twilio for the
   * other leg. */
  startCall(agentId: string, toNumber: string): Promise<void> {
    this.hasRealCallee = true;
    return this.negotiate((sdp) => postCallOffer(sdp, agentId, toNumber));
  }

  /** Shared WebRTC negotiation (mic capture, peer connection, data channel,
   * ICE gathering) for both call flows above — `signal` is the only thing
   * that differs between them: which ferry endpoint the local offer goes to. */
  private async negotiate(signal: (offerSdp: string) => Promise<string>): Promise<void> {
    if (this.status === CallStatus.Connecting || this.status === CallStatus.Connected) {
      return;
    }
    this.aborted = false;
    this.setStatus(CallStatus.Connecting);

    // Activates the platform call-audio session (AudioManager on Android,
    // AVAudioSession on iOS) — without this, react-native-webrtc's audio
    // tracks can negotiate and even report packets flowing while producing
    // no audible output at all. Must happen before media starts flowing.
    // Best-effort: a failure here (native module hiccup) shouldn't take the
    // whole call down — worst case, audio routing just isn't guaranteed.
    startInCallManager(() => this.aborted);

    try {
      const stream = await mediaDevices.getUserMedia({ audio: true, video: false });
      if (this.aborted) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.localStream = stream as unknown as MediaStream;

      const pc = new RTCPeerConnection({ iceServers: [] });
      if (this.aborted) {
        pc.close();
        this.teardown();
        return;
      }
      this.pc = pc;

      for (const track of this.localStream.getTracks()) {
        pc.addTrack(track, this.localStream);
      }

      pc.ontrack = (event: {
        track: {
          kind: string;
          id: string;
          muted: boolean;
          addEventListener: (type: string, cb: () => void) => void;
        };
        streams: unknown[];
      }) => {
        try {
          console.log(
            "[ferry] ontrack fired:",
            event.track.kind,
            event.track.id,
            "streams:",
            event.streams.length,
            "muted:",
            event.track.muted
          );
          // Fires as soon as the track is created during SDP negotiation,
          // not when real RTP packets actually arrive — not proof audio is
          // flowing, just that negotiation reached this point.
          event.track.addEventListener("unmute", () => {
            console.log(
              "[ferry] remote track unmuted:",
              event.track.id
            );
          });
          event.track.addEventListener("mute", () => {
            console.log("[ferry] remote track muted — audio packets stopped:", event.track.id);
          });
        } catch (e) {
          console.warn("[ferry] ontrack handler failed:", e);
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          // This is WebRTC's own transport connecting to ferry — for
          // `startTryAgent` (no real callee) that already means the call is
          // live, so it drives `Connected` directly. For `startCall`, it
          // only means the phone's pipe to ferry is up; the callee hasn't
          // necessarily even started ringing yet, so `Ringing`/`Connected`
          // instead come from ferry's own PEER_CONNECTED_TAG/
          // CALL_RINGING_TAG below, forwarded from the real Twilio leg.
          if (!this.hasRealCallee) {
            this.setStatus(CallStatus.Connected);
          }
          // Belt-and-braces re-assertion: only runs on whichever call
          // instance actually reaches "connected", so a second StrictMode
          // instance's teardown can't undo it the way the earlier
          // startInCallManager()-time attempt could.
          this.setSpeakerOn(true);
        } else if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          this.teardown();
          this.setStatus(CallStatus.Ended);
        }
      };

      const dc = pc.createDataChannel("ferry");
      dc.binaryType = "arraybuffer";
      dc.onmessage = (event: { data: ArrayBuffer }) => {
        // Guarded: this fires from a native event dispatch, same as
        // ontrack — an uncaught throw here (malformed JSON, unexpected
        // shape) would propagate straight out of that dispatch, not just
        // fail this one message.
        try {
          const message = decodeWireMessage(event.data);
          switch (message.kind) {
            case WireMessageKind.Transcript:
              this.events.onTranscript(message.transcript);
              break;
            case WireMessageKind.Translation:
              this.events.onTranslation(message.translation);
              break;
            case WireMessageKind.Ringing:
              // The callee's phone is actively ringing (Twilio, forwarded
              // by ferry) — only ever sent for `startCall`.
              this.setStatus(CallStatus.Ringing);
              break;
            case WireMessageKind.PeerConnected:
              // The callee actually picked up — the real "call is live"
              // signal for `startCall`, distinct from the WebRTC transport
              // to ferry merely being up (see `onconnectionstatechange`).
              this.setStatus(CallStatus.Connected);
              break;
            case WireMessageKind.CallEnded:
              // Explicit "hang up now" from ferry — don't wait on
              // onconnectionstatechange, which can lag well behind this
              // (ICE disconnect detection isn't instant, and the other leg
              // — e.g. Twilio rejecting a dial — can fail in well under a
              // second).
              this.teardown();
              this.setStatus(CallStatus.Ended);
              break;
            case WireMessageKind.Unknown:
              break;
          }
        } catch (e) {
          console.warn("[ferry] failed to decode data-channel message:", e);
        }
      };
      this.dataChannel = dc;

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIceGatheringComplete(pc);
      if (this.aborted) {
        this.teardown();
        return;
      }

      const localDescription = pc.localDescription;
      if (!localDescription) {
        throw new Error("No local SDP after ICE gathering");
      }

      const answerSdp = await signal(localDescription.sdp);
      if (this.aborted) {
        this.teardown();
        return;
      }

      await pc.setRemoteDescription(
        new RTCSessionDescription({ type: "answer", sdp: answerSdp })
      );
      if (this.aborted) {
        this.teardown();
      }
    } catch (err) {
      if (this.aborted) {
        // Already ending — a close/abort mid-negotiation can itself throw;
        // that's expected here, not a real failure to report.
        this.teardown();
        return;
      }
      this.teardown();
      this.setStatus(CallStatus.Error);
      this.events.onError(
        err instanceof SignalingError || err instanceof Error
          ? err.message
          : "Failed to start call"
      );
    }
  }

  /** Mutes/unmutes the mic locally — doesn't touch the connection. */
  setMuted(muted: boolean): void {
    this.localStream?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
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
    this.teardown();
    this.setStatus(CallStatus.Ended);
  }

  private setStatus(status: CallStatus): void {
    this.status = status;
    this.events.onStatusChange(status);
  }

  private teardown(): void {
    // Guarded and ordered first so a native-module hiccup here can never
    // block the rest of cleanup (closing the data channel/peer connection,
    // stopping mic tracks) — those matter more than audio-session teardown.
    try {
      InCallManager.stop();
    } catch (e) {
      console.warn("[ferry] InCallManager.stop failed:", e);
    }
    this.dataChannel?.close();
    this.dataChannel = null;
    this.pc?.close();
    this.pc = null;
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.localStream = null;
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
      }
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
      // The call may have already ended by the time this resolves (fast
      // hang-up, StrictMode abort) — don't force speaker mode back on for
      // a call that's already been torn down.
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

function waitForIceGatheringComplete(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === "complete") {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const finish = () => {
      pc.onicegatheringstatechange = null;
      resolve();
    };
    const timeout = setTimeout(finish, ICE_GATHERING_TIMEOUT_MS);

    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === "complete") {
        clearTimeout(timeout);
        finish();
      }
    };
  });
}
