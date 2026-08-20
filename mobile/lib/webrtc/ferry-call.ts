import {
  MediaStream,
  RTCPeerConnection,
  RTCSessionDescription,
  mediaDevices,
} from "react-native-webrtc";

import { postOffer, SignalingError } from "./signaling";
import {
  decodeWireMessage,
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

// Server-side signaling is non-trickle (ferry/src/transport/webrtc/transport.rs
// waits for full ICE gathering before answering), so we mirror that here rather
// than trickling candidates over a channel that doesn't exist yet. Capped so a
// stalled candidate gatherer can't hang the call indefinitely — we send
// whatever candidates we have after the timeout.
const ICE_GATHERING_TIMEOUT_MS = 5_000;

/**
 * Owns one WebRTC call's imperative lifecycle end to end: mic capture,
 * signaling against ferry's /v1/webrtc/offer, the data channel (transcripts
 * only — audio is a real Opus track in both directions, negotiated by the
 * server), and teardown. Kept independent of React so it can't be caught up
 * in stale-closure/re-render bugs; `useFerryCall` is the thin React wrapper.
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

  constructor(events: FerryCallEvents) {
    this.events = events;
  }

  getStatus(): CallStatus {
    return this.status;
  }

  async start(): Promise<void> {
    if (this.status === CallStatus.Connecting || this.status === CallStatus.Connected) {
      return;
    }
    this.aborted = false;
    this.setStatus(CallStatus.Connecting);

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
        console.log(
          "[ferry] ontrack fired:",
          event.track.kind,
          event.track.id,
          "streams:",
          event.streams.length,
          "muted:",
          event.track.muted
        );
        // A remote track starts muted and fires `unmute` the instant the
        // first real RTP packet arrives — negotiation succeeding (ontrack
        // firing) doesn't mean any audio packets actually showed up.
        event.track.addEventListener("unmute", () => {
          console.log("[ferry] remote track unmuted — audio packets are arriving:", event.track.id);
        });
        event.track.addEventListener("mute", () => {
          console.log("[ferry] remote track muted — audio packets stopped:", event.track.id);
        });
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          this.setStatus(CallStatus.Connected);
        } else if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          this.teardown();
          this.setStatus(CallStatus.Ended);
        }
      };

      const dc = pc.createDataChannel("ferry");
      dc.binaryType = "arraybuffer";
      dc.onmessage = (event: { data: ArrayBuffer }) => {
        const message = decodeWireMessage(event.data);
        if (message.kind === WireMessageKind.Transcript) {
          this.events.onTranscript(message.transcript);
        } else if (message.kind === WireMessageKind.Translation) {
          this.events.onTranslation(message.translation);
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

      const answerSdp = await postOffer(localDescription.sdp);
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
    this.dataChannel?.close();
    this.dataChannel = null;
    this.pc?.close();
    this.pc = null;
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.localStream = null;
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
