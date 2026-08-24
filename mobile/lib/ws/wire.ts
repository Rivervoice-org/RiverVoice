/**
 * Tag-byte protocol for ferry's mobile WebSocket transport — mirrors the
 * constants in ferry/src/codec/transport/mobile_ws.rs. Unlike the old
 * WebRTC data channel, audio travels this same socket in both directions
 * now (tagged `AUDIO_TAG`), alongside transcripts, translations, and call
 * status control bytes.
 */

export const AUDIO_TAG = 0x00;
export const TRANSCRIPT_TAG = 0x02;
export const TRANSLATION_TAG = 0x03;
export const PEER_CONNECTED_TAG = 0x04;
export const CALL_RINGING_TAG = 0x05;
export const CALL_ENDED_TAG = 0x06;

export enum WireMessageKind {
  Audio = "audio",
  Transcript = "transcript",
  Translation = "translation",
  PeerConnected = "peer_connected",
  CallRinging = "call_ringing",
  CallEnded = "call_ended",
  Unknown = "unknown",
}

export type TranscriptMessage = {
  text: string;
  isFinal: boolean;
};

export type TranslationMessage = {
  text: string;
};

export type WireMessage =
  | { kind: WireMessageKind.Audio; audio: Uint8Array }
  | { kind: WireMessageKind.Transcript; transcript: TranscriptMessage }
  | { kind: WireMessageKind.Translation; translation: TranslationMessage }
  | { kind: WireMessageKind.PeerConnected }
  | { kind: WireMessageKind.CallRinging }
  | { kind: WireMessageKind.CallEnded }
  | { kind: WireMessageKind.Unknown; tag: number };

/** Decodes one inbound WebSocket binary message by its leading tag byte. */
export function decodeWireMessage(data: ArrayBuffer): WireMessage {
  const bytes = new Uint8Array(data);
  if (bytes.length === 0) {
    return { kind: WireMessageKind.Unknown, tag: -1 };
  }
  const tag = bytes[0]!;
  const rest = bytes.subarray(1);

  if (tag === AUDIO_TAG) {
    return { kind: WireMessageKind.Audio, audio: rest };
  }

  if (tag === TRANSCRIPT_TAG) {
    const json = new TextDecoder().decode(rest);
    const parsed = JSON.parse(json) as { text: string; is_final: boolean };
    return {
      kind: WireMessageKind.Transcript,
      transcript: { text: parsed.text, isFinal: parsed.is_final },
    };
  }

  if (tag === TRANSLATION_TAG) {
    const json = new TextDecoder().decode(rest);
    const parsed = JSON.parse(json) as { text: string };
    return { kind: WireMessageKind.Translation, translation: { text: parsed.text } };
  }

  if (tag === PEER_CONNECTED_TAG) {
    return { kind: WireMessageKind.PeerConnected };
  }

  if (tag === CALL_RINGING_TAG) {
    return { kind: WireMessageKind.CallRinging };
  }

  if (tag === CALL_ENDED_TAG) {
    return { kind: WireMessageKind.CallEnded };
  }

  return { kind: WireMessageKind.Unknown, tag };
}

/** Tags a chunk of raw PCM16 mic audio for the outbound WebSocket message. */
export function encodeAudioMessage(pcm: Uint8Array): Uint8Array {
  const out = new Uint8Array(1 + pcm.length);
  out[0] = AUDIO_TAG;
  out.set(pcm, 1);
  return out;
}
