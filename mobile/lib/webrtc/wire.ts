/**
 * Tag-byte protocol for ferry's WebRTC data channel — mirrors the constants
 * in ferry/src/serializer/transport/webrtc_dc.rs. Audio no longer travels
 * this channel (it's a real Opus RTP track in both directions); the data
 * channel now only carries transcripts, plus whatever control messages get
 * added later.
 */

export const TRANSCRIPT_TAG = 0x02;

export type TranscriptMessage = {
  text: string;
  isFinal: boolean;
};

export type WireMessage = { kind: "transcript"; transcript: TranscriptMessage } | { kind: "unknown"; tag: number };

/** Decodes one inbound data-channel binary message by its leading tag byte. */
export function decodeWireMessage(data: ArrayBuffer): WireMessage {
  const bytes = new Uint8Array(data);
  const tag = bytes[0];
  const rest = bytes.subarray(1);

  if (tag === TRANSCRIPT_TAG) {
    const json = new TextDecoder().decode(rest);
    const parsed = JSON.parse(json) as { text: string; is_final: boolean };
    return { kind: "transcript", transcript: { text: parsed.text, isFinal: parsed.is_final } };
  }

  return { kind: "unknown", tag };
}
