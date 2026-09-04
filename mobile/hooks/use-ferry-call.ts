import { useCallback, useEffect, useRef, useState } from "react";
import { AudioDevice, CallStatus, FerryCall } from "@/lib/webrtc/ferry-call";

/**
 * Who produced a line during a *live* call — deliberately not the `Speaker`
 * generated from ferry's `call_speaker` enum, which is `caller | callee`.
 *
 * They are different concepts that happened to share a name. The persisted one
 * records which of the two people spoke. This one splits the data channel's two
 * message kinds: a transcript (your own words) and a translation (the voice you
 * hear). In the try-agent demo that second voice really is the agent and there
 * is no callee at all, which is why this cannot simply be renamed to match.
 */
export enum LiveSpeaker {
  Caller = "caller",
  Agent = "agent",
}

export type ConversationLine = { speaker: LiveSpeaker; text: string };

/**
 * React wrapper around `FerryCall` — a real WebRTC call against ferry, via
 * either `startTryAgent` (the one-way /v1/try-agent/offer demo) or
 * `startCall` (a real two-leg /v1/call/start PSTN call). The call object
 * itself lives in a ref so it survives re-renders untouched; this hook only
 * mirrors its events into state and guarantees teardown on unmount.
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
  const [creditsExhausted, setCreditsExhausted] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
  const [activeAudioDevice, setActiveAudioDevice] = useState<AudioDevice>(
    AudioDevice.None,
  );

  const callRef = useRef<FerryCall | null>(null);

  useEffect(() => {
    return () => {
      callRef.current?.end();
      callRef.current = null;
    };
  }, []);

  // Shared by both start entrypoints below — resets per-call state and
  // constructs the FerryCall instance; the only thing that differs between
  // a try-agent demo and a real call is which of its methods gets invoked.
  const createCall = useCallback((): FerryCall | null => {
    if (callRef.current) {
      return null;
    }
    setConversation([]);
    setInterimCaption("");
    setError(null);
    setCreditsExhausted(false);
    setIsMuted(false);
    setAudioDevices([]);
    setActiveAudioDevice(AudioDevice.None);

    const call = new FerryCall({
      onStatusChange: setStatus,
      onTranscript: (message) => {
        // Interim events carry the full current hypothesis for the
        // in-progress utterance, not a delta — replace, don't append.
        // Only a final one becomes a permanent line in the conversation.
        if (message.isFinal) {
          setInterimCaption("");
          setConversation((prev) => [
            ...prev,
            { speaker: LiveSpeaker.Caller, text: message.text },
          ]);
        } else {
          setInterimCaption(message.text);
        }
      },
      onTranslation: (message) => {
        setConversation((prev) => [
          ...prev,
          { speaker: LiveSpeaker.Agent, text: message.text },
        ]);
      },
      onError: setError,
      // By the time this fires, FerryCall's own negotiate() catch has
      // already torn itself down (mic/peer connection released, status set
      // to Error, not Ended — see ferry-call.ts) since this only ever
      // follows a 402 on a call that never connected. Clearing the ref here
      // (not via end(), which would flip status to Ended and trip
      // InCallScreen's leaveScreen effect) is what lets a later
      // createCall() succeed instead of silently no-op'ing forever — it
      // bails out whenever callRef.current is already set, and this
      // provider is mounted once for the whole app, so nothing else would
      // ever clear it after a rejected call.
      onCreditsExhausted: () => {
        callRef.current = null;
        setCreditsExhausted(true);
      },
      onAudioRouteChange: (devices, active) => {
        setAudioDevices(devices);
        setActiveAudioDevice(active);
      },
    });
    callRef.current = call;
    return call;
  }, []);

  const startTryAgent = useCallback(
    (agentId: string) => {
      const call = createCall();
      if (call) void call.startTryAgent(agentId);
    },
    [createCall],
  );

  const startCall = useCallback(
    (agentId: string, toNumber: string) => {
      const call = createCall();
      if (call) void call.startCall(agentId, toNumber);
    },
    [createCall],
  );

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

  const chooseAudioRoute = useCallback((route: AudioDevice) => {
    callRef.current?.chooseAudioRoute(route);
  }, []);

  return {
    status,
    conversation,
    interimCaption,
    error,
    creditsExhausted,
    isMuted,
    audioDevices,
    activeAudioDevice,
    startTryAgent,
    startCall,
    end,
    toggleMute,
    chooseAudioRoute,
  };
}
