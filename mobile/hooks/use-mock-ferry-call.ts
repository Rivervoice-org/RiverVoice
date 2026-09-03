import { useCallback, useState } from "react";
import { AudioDevice, CallStatus } from "@/lib/webrtc/ferry-call";
import { LiveSpeaker, type ConversationLine } from "@/hooks/use-ferry-call";

const MOCK_CONVERSATION: ConversationLine[] = [
  { speaker: LiveSpeaker.Caller, text: "Hey, can you hear me okay?" },
  { speaker: LiveSpeaker.Agent, text: "Oui, je vous entends très bien." },
  {
    speaker: LiveSpeaker.Caller,
    text: "Great — I wanted to ask about the delivery timeline.",
  },
  {
    speaker: LiveSpeaker.Agent,
    text: "Bien sûr, je vérifie ça tout de suite pour vous.",
  },
];

/**
 * Same shape as `useFerryCall`, but no `FerryCall`/WebRTC/ferry involved —
 * fixed, in-memory state only. Swap in for `useFerryCall` in InCall/index.tsx
 * while iterating on that screen's UI, so it can be reached (and lands on
 * `Connected` immediately) without a real call, network, or mic permission.
 * Not wired into any screen by default — remove the import swap once done.
 */
export function useMockFerryCall() {
  const [status, setStatus] = useState<CallStatus>(CallStatus.Connected);
  const [isMuted, setIsMuted] = useState(false);
  const [activeAudioDevice, setActiveAudioDevice] = useState<AudioDevice>(
    AudioDevice.SpeakerPhone,
  );
  // Fixed at mock-mount time — "connected since the screen opened," so the
  // duration line ticks up normally instead of sitting at 0:00.
  const [connectedAt] = useState(() => Date.now());

  const startTryAgent = useCallback(() => {}, []);
  const startCall = useCallback(() => {}, []);
  const end = useCallback(() => setStatus(CallStatus.Ended), []);
  const toggleMute = useCallback(() => setIsMuted((prev) => !prev), []);
  const chooseAudioRoute = useCallback(
    (route: AudioDevice) => setActiveAudioDevice(route),
    [],
  );

  return {
    status,
    conversation: MOCK_CONVERSATION,
    interimCaption: "",
    error: null as string | null,
    isMuted,
    audioDevices: [
      AudioDevice.SpeakerPhone,
      AudioDevice.Earpiece,
      AudioDevice.Bluetooth,
    ] as AudioDevice[],
    activeAudioDevice,
    connectedAt,
    startTryAgent,
    startCall,
    end,
    toggleMute,
    chooseAudioRoute,
  };
}
