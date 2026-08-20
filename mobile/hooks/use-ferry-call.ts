import { useCallback, useEffect, useRef, useState } from "react";
import { CallStatus, FerryCall } from "@/lib/webrtc/ferry-call";
import type { TranscriptMessage } from "@/lib/webrtc/wire";

/**
 * React wrapper around `FerryCall` — a real WebRTC call against ferry's
 * /v1/webrtc/offer endpoint. The call object itself lives in a ref so it
 * survives re-renders untouched; this hook only mirrors its events into
 * state and guarantees teardown on unmount.
 */
export function useFerryCall() {
  const [status, setStatus] = useState<CallStatus>(CallStatus.Idle);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
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
    setTranscript([]);
    setError(null);
    setIsMuted(false);

    const call = new FerryCall({
      onStatusChange: setStatus,
      onTranscript: (message) => setTranscript((prev) => [...prev, message]),
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

  return { status, transcript, error, isMuted, start, end, toggleMute };
}
