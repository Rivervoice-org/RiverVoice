/**
 * WebRTC call to ferry's `/call` endpoint, which sets up translation
 * pipelines and dials a phone number via Twilio. The browser side is
 * identical to `browser-voice.ts`: mic → PcmCapture → data channel,
 * data channel → PcmPlayer → speakers. Only the signaling endpoint
 * and request shape differ.
 *
 * After the data channel opens, the server sends a CONNECTED_TAG
 * (0x02) once the remote end (Twilio) picks up. Until then the
 * browser plays a ringing tone so the caller knows the call is
 * progressing.
 */

import {
  BrowserVoiceStatus,
  BrowserVoiceError,
  BrowserVoiceErrorCode,
  type BrowserVoiceCall,
} from "./browser-voice";

export type { BrowserVoiceStatus, BrowserVoiceError, BrowserVoiceCall };

interface PhoneCallOptions {
  onStatus: (status: BrowserVoiceStatus) => void;
  onError?: (error: BrowserVoiceError) => void;
  onLevel?: (level: number) => void;
}

const FERRY_URL = process.env.NEXT_PUBLIC_FERRY_URL ?? "ws://localhost:8085";
const CONNECT_TIMEOUT_MS = 15_000;

/** Server→client tag meaning the remote end has connected. */
const CONNECTED_TAG = 0x02;

function toHttpUrl(wsUrl: string): string {
  return wsUrl.replace(/^ws/, "http");
}

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

async function openDataChannel(): Promise<WebRtcConnection> {
  const pc = new RTCPeerConnection({ iceServers: [] });
  const channel = pc.createDataChannel("audio", { ordered: false, maxRetransmits: 0 });
  channel.binaryType = "arraybuffer";

  const opened = new Promise<void>((resolve, reject) => {
    channel.onopen = () => resolve();
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

    const signalingUrl = `${toHttpUrl(FERRY_URL)}/call`;
    const response = await fetch(signalingUrl, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sdp: pc.localDescription?.sdp ?? "",
      }),
    });
    const body = (await response.json().catch(() => null)) as {
      data?: { call_id?: string; sdp?: string };
    } | null;
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

// ── ringing tone ─────────────────────────────────────────────────

/**
 * Starts a dual-tone ring (440 Hz + 480 Hz) with a 2 s on / 4 s off
 * cadence. Returns a stop function that kills the oscillators and
 * clears the interval immediately.
 */
function startRinging(ctx: AudioContext): () => void {
  let cleared = false;

  function burst() {
    if (cleared) return;
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, now);
    gain.connect(ctx.destination);

    const osc1 = ctx.createOscillator();
    osc1.frequency.value = 440;
    osc1.connect(gain);
    osc1.start(now);
    osc1.stop(now + 2);

    const osc2 = ctx.createOscillator();
    osc2.frequency.value = 480;
    osc2.connect(gain);
    osc2.start(now);
    osc2.stop(now + 2);
  }

  burst();
  const id = setInterval(burst, 4000);

  return () => {
    cleared = true;
    clearInterval(id);
  };
}

// ── start ────────────────────────────────────────────────────────

const CONNECTED_TIMEOUT_MS = 60_000;

async function start({ onStatus, onError, onLevel }: PhoneCallOptions): Promise<BrowserVoiceCall> {
  onStatus(BrowserVoiceStatus.Connecting);

  const stream = await requestMic();
  let context: AudioContext | undefined;
  let stopRinging: (() => void) | undefined;

  try {
    context = new AudioContext({ sampleRate: 16_000 });
    await context.audioWorklet.addModule("/voice-worklets.js");
    await context.resume();

    const source = context.createMediaStreamSource(stream);
    const capture = new AudioWorkletNode(context, "pcm-capture");
    const player = new AudioWorkletNode(context, "pcm-player");
    source.connect(capture);
    player.connect(context.destination);

    const { pc, channel } = await openDataChannel();

    let stopped = false;
    const teardown = (status: BrowserVoiceStatus) => {
      if (stopped) return;
      stopped = true;
      stopRinging?.();
      channel.close();
      pc.close();
      for (const track of stream.getTracks()) track.stop();
      void context?.close();
      onStatus(status);
    };

    channel.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      const tag = new Uint8Array(event.data, 0, 1)[0];

      if (tag === CONNECTED_TAG) {
        stopRinging?.();
        stopRinging = undefined;
        onStatus(BrowserVoiceStatus.Live);
        return;
      }

      if (tag === 0x01) {
        player.port.postMessage({ type: "clear" });
        return;
      }

      const audio = event.data.slice(1);
      player.port.postMessage(audio, [audio]);
    };

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

    // Play ringing while waiting for the remote end to connect.
    onStatus(BrowserVoiceStatus.Connecting);
    stopRinging = startRinging(context);

    // If the server never sends CONNECTED_TAG (e.g. Twilio failed to
    // dial), time out so the caller is not stuck ringing forever.
    const connectedTimeout = setTimeout(() => {
      if (!stopped) {
        onError?.(
          new BrowserVoiceError(
            BrowserVoiceErrorCode.ConnectTimeout,
            "The other party did not answer. Please try again.",
          ),
        );
        teardown(BrowserVoiceStatus.Ended);
      }
    }, CONNECTED_TIMEOUT_MS);

    const origTeardown = teardown;
    const wrappedTeardown = (s: BrowserVoiceStatus) => {
      clearTimeout(connectedTimeout);
      origTeardown(s);
    };

    // Re-wire teardown references so stop() uses the timeout-clearing version.
    channel.onclose = () => wrappedTeardown(BrowserVoiceStatus.Ended);
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        onError?.(
          new BrowserVoiceError(BrowserVoiceErrorCode.Dropped, "The call dropped unexpectedly."),
        );
        wrappedTeardown(BrowserVoiceStatus.Error);
      }
    };

    return {
      stop: () => {
        clearTimeout(connectedTimeout);
        origTeardown(BrowserVoiceStatus.Ended);
      },
    };
  } catch (cause) {
    stopRinging?.();
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

export const PhoneCall = { start };
