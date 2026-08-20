/**
 * Tag-byte protocol for ferry's WebRTC data channel — mirrors the constants
 * in ferry/src/serializer/transport/webrtc_dc.rs. Audio no longer travels
 * this channel (it's a real Opus RTP track in both directions); the data
 * channel now only carries transcripts and translations, plus whatever
 * control messages get added later.
 */

export const TRANSCRIPT_TAG = 0x02;
export const TRANSLATION_TAG = 0x03;

export enum WireMessageKind {
  Transcript = "transcript",
  Translation = "translation",
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

  return { kind: WireMessageKind.Unknown, tag: tag ?? -1 };
}
