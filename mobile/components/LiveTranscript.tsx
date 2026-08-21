import { memo } from "react";
import { View } from "react-native";
import { Globe, Mic } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { TranscriptPhase } from "@/components/Transcript";
import { useThemeColors } from "@/lib/theme";
import { Speaker, type ConversationLine } from "@/hooks/use-ferry-call";

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
 * bubbles — this only changes when a new line arrives. Distinct from
 * `components/Transcript.tsx`'s `Transcript`, which renders a finished,
 * pre-scripted history rather than a live `ConversationLine[]`.
 */
export const LiveTranscript = memo(function LiveTranscript({
  conversation,
  interim,
  phase,
  agentName,
}: {
  conversation: ConversationLine[];
  interim: string;
  phase: TranscriptPhase;
  agentName: string;
}) {
  const colors = useThemeColors();
  return (
    <View className="gap-3">
      {conversation.map((line, index) => {
        const isAgent = line.speaker === Speaker.Agent;
        return (
          <View key={index} className={isAgent ? "items-end" : "items-start"}>
            <View
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
                isAgent
                  ? "rounded-tr-md border border-border bg-card"
                  : "rounded-tl-md border border-border bg-secondary"
              }`}
            >
              <View className="flex-row items-center gap-1.5">
                {isAgent ? (
                  <Globe size={10} strokeWidth={2} color={colors.river} />
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
              <Text className="mt-1 text-sm leading-snug text-foreground">{line.text}</Text>
            </View>
          </View>
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
              <View className="h-1.5 w-1.5 rounded-full bg-green" />
            </View>
            <Text className="mt-1 text-sm leading-snug text-muted-foreground">{interim}</Text>
          </View>
        </View>
      )}
    </View>
  );
});
