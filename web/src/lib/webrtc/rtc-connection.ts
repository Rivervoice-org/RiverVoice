/**
 * Shared WebRTC transport for both test tabs (try-agent "Voice" and two-leg
 * "Phone"): mic capture, signaling against a ferry offer endpoint, and
 * teardown. Audio is a real Opus RTP track in both directions — negotiated
 * by the browser's WebRTC stack via `addTrack`/`ontrack` — not raw PCM sent
 * over the data channel, which is what this used to do before ferry moved
 * audio off the data channel (see ferry/src/transport/webrtc/transport.rs).
 * The data channel now only carries transcripts/translations (see ./wire.ts),
 * same as mobile/lib/webrtc/ferry-call.ts, which this mirrors.
 */

import {
  decodeWireMessage,
  WireMessageKind,
  type TranscriptMessage,
  type TranslationMessage,
} from "./wire";

export enum BrowserVoiceStatus {
  Idle = "idle",
  Connecting = "connecting",
  Live = "live",
  Ended = "ended",
  Error = "error",
}

export enum BrowserVoiceErrorCode {
  Unsupported = "unsupported",
  MicDenied = "mic-denied",
  MicNotFound = "mic-not-found",
  MicBusy = "mic-busy",
  MicFailed = "mic-failed",
  AudioFailed = "audio-failed",
  ConnectFailed = "connect-failed",
  ConnectTimeout = "connect-timeout",
  Dropped = "dropped",
}

/** Carries a code for callers that branch, and a message fit to show a user. */
export class BrowserVoiceError extends Error {
  constructor(
    readonly code: BrowserVoiceErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "BrowserVoiceError";
  }
}

export interface BrowserVoiceCall {
  stop: () => void;
  /** Only set for endpoints that return one (the two-leg call endpoint). */
  callId?: string;
}

export interface ConnectOptions {
  /** Full URL to POST `{ offer_sdp }` to (ferry's `/v1/try-agent/offer` or `/v1/call/start`). */
  signalingUrl: string;
  onStatus: (status: BrowserVoiceStatus) => void;
  /** Fires only after the call was live — setup failures reject `connect` instead. */
  onError?: (error: BrowserVoiceError) => void;
  onLevel?: (level: number) => void;
  onTranscript?: (message: TranscriptMessage) => void;
  onTranslation?: (message: TranslationMessage) => void;
  /** Fires once, the instant the call's other leg actually connects (e.g. Twilio's leg answering) — not the same as `onStatus(Live)`, which only reflects this browser's own connection to ferry. */
  onPeerConnected?: () => void;
  /** Fires when Twilio reports the other leg's phone is ringing. */
  onRinging?: () => void;
}

const SIGNALING_TIMEOUT_MS = 10_000;
const ICE_GATHERING_TIMEOUT_MS = 5_000;

/**
 * Asks for the microphone every time. The browser only shows a prompt when the
 * choice has not been made yet, but a previous denial has to surface as a
 * refusal rather than a silent no-op.
 */
async function requestMic(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new BrowserVoiceError(
      BrowserVoiceErrorCode.Unsupported,
      "This browser cannot record audio. Microphone access needs a secure (https) page.",
    );
  }

  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: false },
    });
  } catch (cause) {
    const name = cause instanceof DOMException ? cause.name : "";

    switch (name) {
      case "NotAllowedError":
      case "SecurityError":
        throw new BrowserVoiceError(
          BrowserVoiceErrorCode.MicDenied,
          "Microphone blocked. Allow it for this site in your browser settings, then try again.",
          { cause },
        );
      case "NotFoundError":
      case "DevicesNotFoundError":
        throw new BrowserVoiceError(
          BrowserVoiceErrorCode.MicNotFound,
          "No microphone found. Plug one in and try again.",
          { cause },
        );
      case "NotReadableError":
      case "TrackStartError":
        throw new BrowserVoiceError(
          BrowserVoiceErrorCode.MicBusy,
          "Your microphone is in use by another app.",
          { cause },
        );
      default:
        throw new BrowserVoiceError(
          BrowserVoiceErrorCode.MicFailed,
          "Could not open the microphone.",
          { cause },
        );
    }
  }
}

/**
 * Resolves once every ICE candidate has been gathered, or after
 * `ICE_GATHERING_TIMEOUT_MS` — whichever comes first — and continues with
 * whatever candidates were gathered so far. Signaling here is a single
 * request/response with no side channel to trickle candidates back on
 * afterward, so the SDP sent to the server needs every candidate baked in
 * already rather than arriving incrementally (trickle ICE) — matches
 * ferry's non-trickle signaling (ferry/src/transport/webrtc/transport.rs).
 * A bounded wait matters here specifically because gathering can stall
 * indefinitely with no fallback otherwise (no STUN/TURN is configured —
 * see the `iceServers: []` below), which would hang `connect()` forever
 * with the microphone already live. Mirrors
 * `mobile/lib/webrtc/ferry-call.ts`'s `waitForIceGatheringComplete`.
 */
function waitForIceGatheringComplete(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      pc.removeEventListener("icegatheringstatechange", check);
      clearTimeout(timeoutId);
      resolve();
    };
    const check = () => {
      if (pc.iceGatheringState === "complete") finish();
    };
    const timeoutId = setTimeout(finish, ICE_GATHERING_TIMEOUT_MS);
    pc.addEventListener("icegatheringstatechange", check);
  });
}

/**
 * Feeds `onLevel` from the local mic track via an `AnalyserNode`, so the
 * waveform scene still animates even though audio is no longer captured as
 * raw PCM chunks — the track itself goes straight to WebRTC via `addTrack`.
 */
function startLevelMeter(stream: MediaStream, onLevel?: (level: number) => void): () => void {
  if (!onLevel) return () => {};

  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  source.connect(analyser);
  const data = new Uint8Array(analyser.frequencyBinCount);

  let raf = 0;
  const tick = () => {
    analyser.getByteTimeDomainData(data);
    let sumSquares = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sumSquares += v * v;
    }
    const rms = Math.sqrt(sumSquares / data.length);
    onLevel(Math.min(1, rms * 4));
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    source.disconnect();
    void ctx.close();
  };
}

/** Plays ferry's incoming Opus track — not appended to the DOM; a bare `srcObject` + `play()` is enough once the mic prompt has already unlocked autoplay for this tab. */
function attachRemoteAudio(stream: MediaStream): HTMLAudioElement {
  const audio = new Audio();
  audio.autoplay = true;
  audio.srcObject = stream;
  void audio.play().catch((e) => console.warn("[ferry] remote audio play() failed:", e));
  return audio;
}

async function postOffer(
  signalingUrl: string,
  offerSdp: string,
): Promise<{ answerSdp: string; callId?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SIGNALING_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(signalingUrl, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offer_sdp: offerSdp }),
      signal: controller.signal,
    });
  } catch (cause) {
    if (controller.signal.aborted) {
      throw new BrowserVoiceError(
        BrowserVoiceErrorCode.ConnectTimeout,
        "The call server did not answer. Check that ferry is running.",
        { cause },
      );
    }
    throw new BrowserVoiceError(
      BrowserVoiceErrorCode.ConnectFailed,
      "Could not reach the call server.",
      { cause },
    );
  } finally {
    clearTimeout(timeoutId);
  }

  const raw = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  const data =
    raw && typeof raw["data"] === "object" && raw["data"] !== null
      ? (raw["data"] as Record<string, unknown>)
      : null;
  const answerSdp = typeof data?.["answer_sdp"] === "string" ? data["answer_sdp"] : null;
  const callId = typeof data?.["call_id"] === "string" ? data["call_id"] : undefined;

  if (!response.ok || !answerSdp) {
    const message =
      raw && typeof raw["error"] === "object" && raw["error"] !== null
        ? ((raw["error"] as Record<string, unknown>)["message"] as string | undefined)
        : undefined;
    throw new BrowserVoiceError(
      BrowserVoiceErrorCode.ConnectFailed,
      message ?? "Could not reach the call server.",
    );
  }

  return { answerSdp, callId };
}

export async function connectFerryCall(opts: ConnectOptions): Promise<BrowserVoiceCall> {
  opts.onStatus(BrowserVoiceStatus.Connecting);

  const stream = await requestMic();
  let stopLevelMeter: () => void = () => {};
  let remoteAudio: HTMLAudioElement | null = null;
  // Declared here (not `const` inside the try) so the catch block below can
  // close them on a setup failure — otherwise a rejected postOffer or a
  // throwing setRemoteDescription leaves the ICE agent and DTLS transport
  // running forever, with no `stop` handle ever handed back to close them.
  let pc: RTCPeerConnection | undefined;
  let dc: RTCDataChannel | undefined;

  try {
    const peerConnection = new RTCPeerConnection({ iceServers: [] });
    pc = peerConnection;
    for (const track of stream.getTracks()) peerConnection.addTrack(track, stream);

    const dataChannel = peerConnection.createDataChannel("ferry");
    dc = dataChannel;
    dataChannel.binaryType = "arraybuffer";
    dataChannel.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      try {
        const message = decodeWireMessage(event.data);
        if (message.kind === WireMessageKind.Transcript) {
          opts.onTranscript?.(message.transcript);
        } else if (message.kind === WireMessageKind.Translation) {
          opts.onTranslation?.(message.translation);
        } else if (message.kind === WireMessageKind.PeerConnected) {
          opts.onPeerConnected?.();
        } else if (message.kind === WireMessageKind.Ringing) {
          opts.onRinging?.();
        }
      } catch (e) {
        console.warn("[ferry] failed to decode data-channel message:", e);
      }
    };

    peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream) remoteAudio = attachRemoteAudio(remoteStream);
    };

    let stopped = false;
    const teardown = (status: BrowserVoiceStatus) => {
      if (stopped) return;
      stopped = true;
      stopLevelMeter();
      dataChannel.close();
      peerConnection.close();
      for (const track of stream.getTracks()) track.stop();
      if (remoteAudio) {
        remoteAudio.srcObject = null;
        remoteAudio = null;
      }
      opts.onStatus(status);
    };

    peerConnection.onconnectionstatechange = () => {
      if (peerConnection.connectionState === "connected") {
        opts.onStatus(BrowserVoiceStatus.Live);
      } else if (
        peerConnection.connectionState === "failed" ||
        peerConnection.connectionState === "disconnected"
      ) {
        opts.onError?.(
          new BrowserVoiceError(BrowserVoiceErrorCode.Dropped, "The call dropped unexpectedly."),
        );
        teardown(BrowserVoiceStatus.Error);
      } else if (peerConnection.connectionState === "closed") {
        teardown(BrowserVoiceStatus.Ended);
      }
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    await waitForIceGatheringComplete(peerConnection);

    const localDescription = peerConnection.localDescription;
    if (!localDescription) throw new Error("No local SDP after ICE gathering");

    const { answerSdp, callId } = await postOffer(opts.signalingUrl, localDescription.sdp);
    await peerConnection.setRemoteDescription({ type: "answer", sdp: answerSdp });

    stopLevelMeter = startLevelMeter(stream, opts.onLevel);

    return {
      callId,
      stop: () => teardown(BrowserVoiceStatus.Ended),
    };
  } catch (cause) {
    dc?.close();
    pc?.close();
    for (const track of stream.getTracks()) track.stop();
    if (cause instanceof BrowserVoiceError) throw cause;
    throw new BrowserVoiceError(
      BrowserVoiceErrorCode.ConnectFailed,
      "Could not reach the call server.",
      { cause },
    );
  }
}
