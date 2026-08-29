import { memo } from "react";
import { View } from "react-native";
import { Mic, Volume2 } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { TranscriptPhase } from "@/lib/call-status";
import { TypingDots } from "@/components/TypingDots";
import { KaraokeText } from "@/components/KaraokeText";
import { useThemeColors } from "@/lib/theme";
import { LiveSpeaker, type ConversationLine } from "@/hooks/use-ferry-call";

/**
 * One bubble. Memoized on purpose, separately from the list: while a line
 * is playing, `playingWordIndex` changes every ~150-300ms as the highlight
 * moves word to word. Without this split, that tick re-rendered *every*
 * bubble in the whole conversation (not just the playing one) on every
 * change — cheap with two lines, but with a full call's worth of history it
 * was enough main-thread work, several times a second, to make touch
 * gestures on the scroll view feel like they'd stopped registering
 * partway down a long transcript. Every non-playing bubble is passed a
 * constant wordIndex of -1, so its props genuinely never change between
 * ticks and memo bails out — only the one active bubble re-renders.
 */
const TranscriptBubble = memo(function TranscriptBubble({
  line,
  agentName,
  isPlaying,
  playingWordIndex,
}: {
  line: ConversationLine;
  agentName: string;
  isPlaying: boolean;
  playingWordIndex: number;
}) {
  const colors = useThemeColors();
  const isAgent = line.speaker === LiveSpeaker.Agent;

  return (
    <View className={isAgent ? "items-end" : "items-start"}>
      <View
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
          isAgent
            ? "rounded-tr-md border border-border bg-card"
            : "rounded-tl-md border border-border bg-secondary"
        } ${isPlaying ? "border-foreground/30" : ""}`}
      >
        <View className="flex-row items-center gap-1.5">
          {isAgent ? (
            <Volume2
              size={10}
              strokeWidth={2}
              color={isPlaying ? colors.ink : colors.muted}
            />
          ) : (
            <Mic size={10} strokeWidth={2} color={colors.muted} />
          )}
          <Text
            className={`text-[10px] font-semibold uppercase tracking-[0.08em] ${
              isAgent ? "text-muted-foreground" : "text-foreground"
            }`}
          >
            {isAgent ? agentName : "You"}
          </Text>
        </View>
        {isPlaying ? (
          <>
            <KaraokeText text={line.text} activeIndex={playingWordIndex} />
            <View className="mt-1 flex-row items-center gap-1.5">
              <TypingDots color={colors.muted} size={4} />
              <Text className="text-[10px] text-muted-foreground">
                Speaking…
              </Text>
            </View>
          </>
        ) : (
          <Text className="mt-1 text-sm leading-snug text-foreground">
            {line.text}
          </Text>
        )}
      </View>
    </View>
  );
});

/**
 * Live conversation: your captioned speech ("caller") interleaved with
 * ferry's translated text ("agent") — both come off the same data channel
 * from ferry/src/stages/stt.rs (Transcription frames) and
 * ferry/src/stages/tts.rs (MtText frames), already in true chronological
 * order by the time they reach `conversation`. Only the translated *text*
 * is captioned here; the agent's actual voice comes back separately over
 * the WebRTC audio track, not through this data channel.
 *
 * Memoized so a per-second duration tick elsewhere never re-renders the
 * bubbles — this only changes when a new line arrives.
 *
 * The try-agent demo's own renderer, deliberately not `CallTranscript`. A
 * demo has one agent and no second party, so it labels bubbles by name and
 * shows which one is speaking; a real call has two people and labels nothing,
 * because side alone says who spoke.
 */
export const TryAgentTranscript = memo(function TryAgentTranscript({
  conversation,
  interim,
  phase,
  agentName,
  isAgentAudioPlaying = false,
  playingWordIndex = -1,
}: {
  conversation: ConversationLine[];
  interim: string;
  phase: TranscriptPhase;
  agentName: string;
  /** True while the most recent agent line's TTS is actually sounding out
   * over the line to the other party — not just while its text is on
   * screen. Only ever applies to the last agent line: audio plays one line
   * at a time, in order. */
  isAgentAudioPlaying?: boolean;
  /** Index of the word currently being spoken within that line, so the
   * exact word can be highlighted rather than just the whole bubble. -1
   * when nothing is playing. */
  playingWordIndex?: number;
}) {
  const colors = useThemeColors();
  const lastAgentIndex = conversation.reduce(
    (last, line, index) => (line.speaker === LiveSpeaker.Agent ? index : last),
    -1,
  );

  return (
    <View className="gap-3">
      {conversation.map((line, index) => {
        const isPlaying =
          line.speaker === LiveSpeaker.Agent &&
          index === lastAgentIndex &&
          isAgentAudioPlaying;
        return (
          <TranscriptBubble
            key={index}
            line={line}
            agentName={agentName}
            isPlaying={isPlaying}
            playingWordIndex={isPlaying ? playingWordIndex : -1}
          />
        );
      })}

      {phase === TranscriptPhase.Live && interim.length > 0 && (
        <View className="items-start">
          <View className="max-w-[85%] rounded-2xl rounded-tl-md border border-border bg-secondary px-3.5 py-2.5">
            <View className="flex-row items-center gap-1.5">
              <Mic size={10} strokeWidth={2} color={colors.muted} />
              <Text className="text-[10px] font-semibold uppercase tracking-[0.08em] text-foreground">
                You
              </Text>
              <TypingDots color={colors.green} size={4} />
            </View>
            <Text className="mt-1 text-sm leading-snug text-muted-foreground">
              {interim}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
});
