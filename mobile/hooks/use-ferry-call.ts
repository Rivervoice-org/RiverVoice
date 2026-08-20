import { useCallback, useEffect, useRef, useState } from "react";
import { CallStatus, FerryCall } from "@/lib/webrtc/ferry-call";

export enum Speaker {
  Caller = "caller",
  Agent = "agent",
}

export type ConversationLine = { speaker: Speaker; text: string };

/**
 * React wrapper around `FerryCall` — a real WebRTC call against ferry's
 * /v1/webrtc/offer endpoint. The call object itself lives in a ref so it
 * survives re-renders untouched; this hook only mirrors its events into
 * state and guarantees teardown on unmount.
 *
 * Caller captions and agent translations arrive as two separate wire message
 * kinds but in one true chronological order (both come off the same data
 * channel, in the order ferry sent them) — merged into a single
 * `conversation` log here rather than two independent arrays, so the UI
 * doesn't have to guess how to interleave them after the fact.
 */
export function useFerryCall() {
  const [status, setStatus] = useState<CallStatus>(CallStatus.Idle);
  const [conversation, setConversation] = useState<ConversationLine[]>([]);
  const [interimCaption, setInterimCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  const callRef = useRef<FerryCall | null>(null);

  useEffect(() => {
    return () => {
      callRef.current?.end();
      callRef.current = null;
    };
  }, []);

  const start = useCallback(() => {
    if (callRef.current) {
      return;
    }
    setConversation([]);
    setInterimCaption("");
    setError(null);
    setIsMuted(false);

    const call = new FerryCall({
      onStatusChange: setStatus,
      onTranscript: (message) => {
        // Interim events carry the full current hypothesis for the
        // in-progress utterance, not a delta — replace, don't append.
        // Only a final one becomes a permanent line in the conversation.
        if (message.isFinal) {
          setInterimCaption("");
          setConversation((prev) => [...prev, { speaker: Speaker.Caller, text: message.text }]);
        } else {
          setInterimCaption(message.text);
        }
      },
      onTranslation: (message) => {
        setConversation((prev) => [...prev, { speaker: Speaker.Agent, text: message.text }]);
      },
      onError: setError,
    });
    callRef.current = call;
    void call.start();
  }, []);

  const end = useCallback(() => {
    callRef.current?.end();
    callRef.current = null;
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      callRef.current?.setMuted(next);
      return next;
    });
  }, []);

  return { status, conversation, interimCaption, error, isMuted, start, end, toggleMute };
}
