import { useCallback, useEffect, useRef, useState } from "react";
import { CallStatus } from "@/lib/webrtc/ferry-call";
import type { ConversationLine } from "@/hooks/use-ferry-call";

const CONNECT_DELAY_MS = 1800;

/**
 * Same shape as `useFerryCall` (status/conversation/mute/speaker/start/end)
 * so the in-call screen doesn't need to know it's not a real call — just
 * simulates the ringing → connected transition with no mic, no WebRTC, no
 * ferry request. Conversation/captions stay empty since there's nothing
 * real to transcribe.
 */
export function useMockCall() {
  const [status, setStatus] = useState<CallStatus>(CallStatus.Idle);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const start = useCallback(() => {
    if (timeoutRef.current) return;
    setStatus(CallStatus.Connecting);
    timeoutRef.current = setTimeout(() => {
      setStatus(CallStatus.Connected);
      timeoutRef.current = null;
    }, CONNECT_DELAY_MS);
  }, []);

  const end = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setStatus(CallStatus.Ended);
  }, []);

  const toggleMute = useCallback(() => setIsMuted((prev) => !prev), []);
  const toggleSpeaker = useCallback(() => setIsSpeakerOn((prev) => !prev), []);

  return {
    status,
    conversation: [] as ConversationLine[],
    interimCaption: "",
    error: null as string | null,
    isMuted,
    isSpeakerOn,
    start,
    end,
    toggleMute,
    toggleSpeaker,
  };
}
