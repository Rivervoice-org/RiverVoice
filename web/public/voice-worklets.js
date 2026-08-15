// Audio worklets for the builder's voice test call.
//
// The pipeline speaks 16 kHz mono s16le PCM in 480-sample chunks (30 ms —
// exactly one RNNoise frame, so nothing passes the denoiser unfiltered).
// Capture accumulates mic samples into chunks of that size; playback queues
// returned chunks and drains them at the audio clock's pace.

const CHUNK_SAMPLES = 480;

class PcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(CHUNK_SAMPLES);
    this.length = 0;
  }

  process(inputs) {
    const channel = inputs[0][0];
    if (!channel) return true;

    let read = 0;
    while (read < channel.length) {
      const take = Math.min(CHUNK_SAMPLES - this.length, channel.length - read);
      this.buffer.set(channel.subarray(read, read + take), this.length);
      this.length += take;
      read += take;

      if (this.length === CHUNK_SAMPLES) {
        const pcm = new Int16Array(CHUNK_SAMPLES);
        for (let i = 0; i < CHUNK_SAMPLES; i++) {
          const sample = Math.max(-1, Math.min(1, this.buffer[i]));
          pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        }
        this.port.postMessage(pcm.buffer, [pcm.buffer]);
        this.length = 0;
      }
    }
    return true;
  }
}

class PcmPlayer extends AudioWorkletProcessor {
  constructor() {
    super();
    this.queue = [];
    this.offset = 0;
    this.port.onmessage = (event) => {
      // An interruption (see browser-voice.ts's channel.onmessage) posts
      // `{ type: "clear" }` instead of an audio buffer — drop whatever's
      // still queued so playback actually stops immediately, rather than
      // finishing audio that was already in flight before the bot's
      // reply was cut off server-side.
      if (event.data && event.data.type === "clear") {
        this.queue = [];
        this.offset = 0;
        return;
      }
      this.queue.push(new Int16Array(event.data));
    };
  }

  process(_inputs, outputs) {
    const out = outputs[0][0];
    if (!out) return true;

    let written = 0;
    while (written < out.length && this.queue.length) {
      const chunk = this.queue[0];
      out[written++] = chunk[this.offset++] / 0x8000;
      if (this.offset === chunk.length) {
        this.queue.shift();
        this.offset = 0;
      }
    }
    // Underrun: no data yet, play silence rather than stall.
    while (written < out.length) out[written++] = 0;
    return true;
  }
}

registerProcessor("pcm-capture", PcmCapture);
registerProcessor("pcm-player", PcmPlayer);
