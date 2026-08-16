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
}

export interface BrowserVoiceOptions {
  agentId: string;
  /** Matches agent_versions.version (harbor/db/migrations/0003_agents.sql). */
  version: number;
  onStatus: (status: BrowserVoiceStatus) => void;
  /** Fires only after the call was live — setup failures reject `start` instead. */
  onError?: (error: BrowserVoiceError) => void;
  onLevel?: (level: number) => void;
}

const FERRY_URL = process.env.NEXT_PUBLIC_FERRY_URL ?? "ws://localhost:8085";
const CONNECT_TIMEOUT_MS = 10_000;

function chunkLevel(buffer: ArrayBuffer): number {
  const samples = new Int16Array(buffer);
  let sumSquares = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i] / 0x8000;
    sumSquares += s * s;
  }
  const rms = Math.sqrt(sumSquares / samples.length);
  return Math.min(1, rms * 4);
}

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

/** `ws://`/`wss://` -> `http://`/`https://`, for the signaling endpoint. */
function toHttpUrl(wsUrl: string): string {
  return wsUrl.replace(/^ws/, "http");
}

/**
 * Resolves once every ICE candidate has been gathered. Signaling here is a
 * single request/response with no side channel to trickle candidates back
 * on afterward, so the SDP sent to the server needs every candidate baked
 * in already rather than arriving incrementally (trickle ICE) — fine for
 * same-machine/LAN dev, where gathering finishes near-instantly.
 */
function waitForIceGatheringComplete(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    pc.addEventListener("icegatheringstatechange", function check() {
      if (pc.iceGatheringState === "complete") {
        pc.removeEventListener("icegatheringstatechange", check);
        resolve();
      }
    });
  });
}

interface WebRtcConnection {
  pc: RTCPeerConnection;
  channel: RTCDataChannel;
}

/**
 * Resolves once the data channel is open, so a caller that gets a call
 * knows it is live. The transport here is WebRTC purely for its UDP
 * properties: `channel` is unordered/unreliable (`maxRetransmits: 0`),
 * so it behaves like raw UDP rather than the WebSocket's TCP — but it
 * still carries the exact same raw PCM messages, matching ferry's
 * `WebRtcSerializer` (the same dialect as `BrowserSerializer`).
 */
async function openDataChannel(
  signalingUrl: string,
  agentId: string,
  version: number,
): Promise<WebRtcConnection> {
  // No STUN server: fine for same-machine/LAN dev, where host candidates
  // alone are enough to connect. TODO: add one (and trickle ICE) once this
  // needs to work across networks.
  const pc = new RTCPeerConnection({ iceServers: [] });
  const channel = pc.createDataChannel("audio", { ordered: false, maxRetransmits: 0 });
  channel.binaryType = "arraybuffer";

  const opened = new Promise<void>((resolve, reject) => {
    channel.onopen = () => resolve();
    // The handshake gives the page no reason for the failure — a refused
    // connection, a rejected session cookie and a blocked origin all look
    // the same here, so the message stays general (same as the WebSocket
    // path's onerror).
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        reject(
          new BrowserVoiceError(
            BrowserVoiceErrorCode.ConnectFailed,
            "Could not reach the call server.",
          ),
        );
      }
    };
  });

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new BrowserVoiceError(
          BrowserVoiceErrorCode.ConnectTimeout,
          "The call server did not answer. Check that ferry is running.",
        ),
      );
    }, CONNECT_TIMEOUT_MS);
  });

  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitForIceGatheringComplete(pc);

    // Cookie-authenticated the same way the WebSocket upgrade is —
    // `credentials: "include"` is `fetch`'s equivalent of the browser
    // sending cookies automatically on the WS handshake.
    const response = await fetch(signalingUrl, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sdp: pc.localDescription?.sdp ?? "",
        agent_id: agentId,
        version,
      }),
    });
    const body = (await response.json().catch(() => null)) as { data?: { sdp?: string } } | null;
    if (!response.ok || !body?.data?.sdp) {
      throw new BrowserVoiceError(
        BrowserVoiceErrorCode.ConnectFailed,
        "Could not reach the call server.",
      );
    }

    await pc.setRemoteDescription({ type: "answer", sdp: body.data.sdp });
    await Promise.race([opened, timeout]);

    return { pc, channel };
  } catch (cause) {
    pc.close();
    if (cause instanceof BrowserVoiceError) throw cause;
    throw new BrowserVoiceError(
      BrowserVoiceErrorCode.ConnectFailed,
      "Could not reach the call server.",
      { cause },
    );
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

async function start({
  agentId,
  version,
  onStatus,
  onError,
  onLevel,
}: BrowserVoiceOptions): Promise<BrowserVoiceCall> {
  onStatus(BrowserVoiceStatus.Connecting);

  const stream = await requestMic();
  let context: AudioContext | undefined;

  try {
    context = new AudioContext({ sampleRate: 16_000 });
    await context.audioWorklet.addModule("/voice-worklets.js");
    await context.resume();

    const source = context.createMediaStreamSource(stream);
    const capture = new AudioWorkletNode(context, "pcm-capture");
    const player = new AudioWorkletNode(context, "pcm-player");
    source.connect(capture);
    player.connect(context.destination);

    const { pc, channel } = await openDataChannel(
      `${toHttpUrl(FERRY_URL)}/browser-call/webrtc`,
      agentId,
      version,
    );

    let stopped = false;
    const teardown = (status: BrowserVoiceStatus) => {
      if (stopped) return;
      stopped = true;
      channel.close();
      pc.close();
      for (const track of stream.getTracks()) track.stop();
      void context?.close();
      onStatus(status);
    };

    channel.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      // Server->client messages carry a one-byte tag ferry's
      // WebRtcSerializer prefixes every message with (see its doc
      // comment): 0x00 = audio chunk, followed by raw PCM; 0x01 =
      // interrupt, telling the player to drop whatever it has queued so
      // the bot's speech actually stops instead of finishing whatever
      // was already sent before the interruption happened server-side.
      const tag = new Uint8Array(event.data, 0, 1)[0];
      if (tag === 0x01) {
        player.port.postMessage({ type: "clear" });
        return;
      }
      const audio = event.data.slice(1);
      player.port.postMessage(audio, [audio]);
    };
    // No onerror on RTCDataChannel — connection failure surfaces through
    // connectionState instead.
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        onError?.(
          new BrowserVoiceError(BrowserVoiceErrorCode.Dropped, "The call dropped unexpectedly."),
        );
        teardown(BrowserVoiceStatus.Error);
      }
    };
    channel.onclose = () => teardown(BrowserVoiceStatus.Ended);

    capture.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      onLevel?.(chunkLevel(event.data));
      if (channel.readyState === "open") channel.send(event.data);
    };

    onStatus(BrowserVoiceStatus.Live);
    return { stop: () => teardown(BrowserVoiceStatus.Ended) };
  } catch (cause) {
    // Anything past the mic prompt leaves the device open, and a live
    // recording indicator over a call that never started reads as a bug.
    for (const track of stream.getTracks()) track.stop();
    void context?.close();

    if (cause instanceof BrowserVoiceError) throw cause;
    throw new BrowserVoiceError(
      BrowserVoiceErrorCode.AudioFailed,
      "Could not start audio playback.",
      { cause },
    );
  }
}

export const BrowserVoice = { start };
