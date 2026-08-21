/**
 * Tag-byte protocol for ferry's WebRTC data channel — mirrors the constants
 * in ferry/src/codec/transport/webrtc_dc.rs. Audio doesn't travel this
 * channel (it's a real Opus RTP track in both directions); the data channel
 * only carries transcripts and translations, plus whatever control messages
 * get added later. Ported from mobile/lib/webrtc/wire.ts — same wire format,
 * no React Native dependency either way.
 */

export const TRANSCRIPT_TAG = 0x02;
export const TRANSLATION_TAG = 0x03;
/** No payload — sent once, the instant the call's other leg actually connects. */
export const PEER_CONNECTED_TAG = 0x04;
/** No payload — sent when Twilio reports the other leg's phone is ringing. */
export const CALL_RINGING_TAG = 0x05;

export enum WireMessageKind {
  Transcript = "transcript",
  Translation = "translation",
  PeerConnected = "peer-connected",
  Ringing = "ringing",
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
  | { kind: WireMessageKind.Transcript; transcript: TranscriptMessage }
  | { kind: WireMessageKind.Translation; translation: TranslationMessage }
  | { kind: WireMessageKind.PeerConnected }
  | { kind: WireMessageKind.Ringing }
  | { kind: WireMessageKind.Unknown; tag: number };

/** Decodes one inbound data-channel binary message by its leading tag byte. */
export function decodeWireMessage(data: ArrayBuffer): WireMessage {
  const bytes = new Uint8Array(data);
  if (bytes.length === 0) {
    return { kind: WireMessageKind.Unknown, tag: -1 };
  }
  const tag = bytes[0];
  const rest = bytes.subarray(1);

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
    return { kind: WireMessageKind.Ringing };
  }

  return { kind: WireMessageKind.Unknown, tag: tag ?? -1 };
}
