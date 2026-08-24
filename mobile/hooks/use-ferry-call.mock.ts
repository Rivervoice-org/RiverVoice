import { useCallback, useEffect, useRef, useState } from "react";
import { CallStatus } from "@/lib/webrtc/ferry-call";
import { Speaker, type ConversationLine } from "@/hooks/use-ferry-call";

/**
 * TEMPORARY test double for `useFerryCall` — same public shape, but never
 * touches the mic, WebRTC, or ferry's signaling API. Drives the InCall
 * screen's UI through a scripted timeline (connecting → connected → a few
 * fake caption/translation lines) purely with local timers, so the screen
 * can be exercised end to end without a backend. Swap the import in
 * `screens/InCall/index.tsx` back to `@/hooks/use-ferry-call` when done.
 */

// English caller, Hindi (Devanagari) translation — denser than a couple of
// lines on purpose, to stress the transcript's scrolling/auto-scroll and
// give the karaoke highlight real conjunct-heavy words to chew on. No
// `atMs` here: `runScript` below lays these out back-to-back itself, each
// one starting only once the previous has actually finished "playing" —
// hardcoded offsets would either overlap (two lines fighting over
// `playingWordIndex`) or leave dead air once line lengths vary this much.
const SCRIPT: { speaker: Speaker; text: string }[] = [
  { speaker: Speaker.Caller, text: "Hi, I'm calling about my order — it hasn't arrived yet." },
  {
    speaker: Speaker.Agent,
    text: "नमस्ते, मैं अपने ऑर्डर के बारे में कॉल कर रहा हूँ — यह अभी तक नहीं पहुँचा।",
  },
  { speaker: Speaker.Caller, text: "It was supposed to arrive three days ago." },
  { speaker: Speaker.Agent, text: "यह तीन दिन पहले पहुँचना था।" },
  { speaker: Speaker.Caller, text: "Can you check the tracking number for me?" },
  { speaker: Speaker.Agent, text: "क्या आप मेरे लिए ट्रैकिंग नंबर देख सकते हैं?" },
  { speaker: Speaker.Caller, text: "Sure — the order number is four five six seven." },
  { speaker: Speaker.Agent, text: "ज़रूर — ऑर्डर नंबर चार पाँच छह सात है।" },
  { speaker: Speaker.Caller, text: "I already tried the website, but it just shows an error." },
  {
    speaker: Speaker.Agent,
    text: "मैंने पहले ही वेबसाइट पर कोशिश की, लेकिन वहाँ सिर्फ़ एक एरर दिखता है।",
  },
  { speaker: Speaker.Caller, text: "Is there any way to get a refund if the package is lost?" },
  {
    speaker: Speaker.Agent,
    text: "अगर पैकेज खो गया है, तो क्या रिफंड पाने का कोई तरीका है?",
  },
  { speaker: Speaker.Caller, text: "Okay, that sounds fair. Thank you for checking." },
  { speaker: Speaker.Agent, text: "ठीक है, यह उचित लगता है। जाँचने के लिए धन्यवाद।" },
  { speaker: Speaker.Caller, text: "One more thing — can you also update my delivery address?" },
  {
    speaker: Speaker.Agent,
    text: "एक और बात — क्या आप मेरा डिलीवरी पता भी अपडेट कर सकते हैं?",
  },
];

export function useFerryCall() {
  const [status, setStatus] = useState<CallStatus>(CallStatus.Idle);
  const [conversation, setConversation] = useState<ConversationLine[]>([]);
  const [interimCaption, setInterimCaption] = useState("");
  const [error] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isAgentAudioPlaying, setIsAgentAudioPlaying] = useState(false);
  const [playingWordIndex, setPlayingWordIndex] = useState(-1);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const runScript = useCallback(() => {
    setStatus(CallStatus.Connecting);
    timers.current.push(
      setTimeout(() => setStatus(CallStatus.Connected), 900),
    );

    const GAP_MS = 350; // brief silence between lines, same as a real turn-taking pause
    let cursor = 1300;

    for (const line of SCRIPT) {
      const startAt = cursor;

      if (line.speaker === Speaker.Caller) {
        // Interim caption grows in as if STT is still catching up, then
        // finalizes — duration scales with the line so a long sentence
        // doesn't finalize as fast as a short one.
        const typingMs = Math.max(500, line.text.length * 35);
        timers.current.push(
          setTimeout(
            () => setInterimCaption(line.text.slice(0, Math.max(1, line.text.length - 6))),
            startAt,
          ),
        );
        timers.current.push(
          setTimeout(() => {
            setInterimCaption("");
            setConversation((prev) => [...prev, { speaker: line.speaker, text: line.text }]);
          }, startAt + typingMs),
        );
        cursor = startAt + typingMs + GAP_MS;
        continue;
      }

      // Translated text lands the instant MT finishes, but the TTS audio
      // it's spoken as takes real time to play out over the line — mocked
      // here as roughly a speaking rate, so the "playing" indicator has a
      // duration to actually show instead of just flashing. Split across
      // words (weighted by word length, since a long Devanagari conjunct
      // takes longer to say than "है") so the UI can highlight the word
      // being spoken right now, not just "something is playing". The next
      // line in the script only starts once this finishes, so two agent
      // lines' playback windows never fight over `playingWordIndex`.
      const words = line.text.split(/\s+/);
      const weights = words.map((w) => w.length + 1);
      const totalWeight = weights.reduce((a, b) => a + b, 0);
      const playbackMs = Math.max(900, line.text.length * 70);

      timers.current.push(
        setTimeout(() => {
          setConversation((prev) => [...prev, { speaker: line.speaker, text: line.text }]);
          setIsAgentAudioPlaying(true);
          let elapsed = 0;
          words.forEach((_, i) => {
            timers.current.push(setTimeout(() => setPlayingWordIndex(i), elapsed));
            elapsed += (weights[i] / totalWeight) * playbackMs;
          });
          timers.current.push(
            setTimeout(() => {
              setIsAgentAudioPlaying(false);
              setPlayingWordIndex(-1);
            }, playbackMs),
          );
        }, startAt),
      );
      cursor = startAt + playbackMs + GAP_MS;
    }
  }, []);

  const startTryAgent = useCallback(
    (_agentId: string) => {
      clearTimers();
      setConversation([]);
      setInterimCaption("");
      setIsAgentAudioPlaying(false);
      setPlayingWordIndex(-1);
      runScript();
    },
    [clearTimers, runScript],
  );

  const startCall = useCallback(
    (_agentId: string, _toNumber: string) => {
      clearTimers();
      setConversation([]);
      setInterimCaption("");
      setIsAgentAudioPlaying(false);
      setPlayingWordIndex(-1);
      runScript();
    },
    [clearTimers, runScript],
  );

  const end = useCallback(() => {
    clearTimers();
    setStatus(CallStatus.Ended);
    setIsAgentAudioPlaying(false);
    setPlayingWordIndex(-1);
  }, [clearTimers]);

  const toggleMute = useCallback(() => setIsMuted((prev) => !prev), []);
  const toggleSpeaker = useCallback(() => setIsSpeakerOn((prev) => !prev), []);

  return {
    status,
    conversation,
    interimCaption,
    error,
    isMuted,
    isSpeakerOn,
    isAgentAudioPlaying,
    playingWordIndex,
    startTryAgent,
    startCall,
    end,
    toggleMute,
    toggleSpeaker,
  };
}
