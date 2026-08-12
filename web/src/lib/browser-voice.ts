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

/** Resolves once the socket is open, so a caller that gets a call knows it is live. */
function openSocket(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.binaryType = "arraybuffer";

    const timer = setTimeout(() => {
      socket.close();
      reject(
        new BrowserVoiceError(
          BrowserVoiceErrorCode.ConnectTimeout,
          "The call server did not answer. Check that ferry is running.",
        ),
      );
    }, CONNECT_TIMEOUT_MS);

    socket.onopen = () => {
      clearTimeout(timer);
      socket.onopen = null;
      socket.onerror = null;
      resolve(socket);
    };

    // The handshake gives the page no reason for the failure — a refused
    // connection, a rejected session cookie and a blocked origin all look the
    // same here, so the message stays general.
    socket.onerror = () => {
      clearTimeout(timer);
      reject(
        new BrowserVoiceError(
          BrowserVoiceErrorCode.ConnectFailed,
          "Could not reach the call server.",
        ),
      );
    };
  });
}

async function start({
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

    const socket = await openSocket(`${FERRY_URL}/browser-call`);

    let stopped = false;
    const teardown = (status: BrowserVoiceStatus) => {
      if (stopped) return;
      stopped = true;
      socket.close();
      for (const track of stream.getTracks()) track.stop();
      void context?.close();
      onStatus(status);
    };

    socket.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      player.port.postMessage(event.data, [event.data]);
    };
    socket.onerror = () => {
      onError?.(
        new BrowserVoiceError(BrowserVoiceErrorCode.Dropped, "The call dropped unexpectedly."),
      );
      teardown(BrowserVoiceStatus.Error);
    };
    socket.onclose = () => teardown(BrowserVoiceStatus.Ended);

    capture.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      onLevel?.(chunkLevel(event.data));
      if (socket.readyState === WebSocket.OPEN) socket.send(event.data);
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
