import { memo } from "react";
import { View } from "react-native";
import { Globe, Mic } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/lib/theme";

export type TranscriptLine = {
  speaker: "caller" | "agent";
  name: string;
  time?: string;
  original: string;
  translated: string | null;
};

export enum TranscriptPhase {
  Connecting = "connecting",
  Live = "live",
  Ended = "ended",
}

/**
 * The one transcript renderer. The try-agent screen feeds it a live script and
 * a reveal count so lines appear as the mock call plays; the transcript screen
 * hands it a finished history and lets it render whole.
 *
 * Memoized so the per-second duration tick in the try-agent screen never
 * re-renders the bubbles — the transcript only changes when a line is revealed.
 */
export const Transcript = memo(function Transcript({
  lines,
  revealed = lines.length,
  phase = TranscriptPhase.Ended,
}: {
  lines: TranscriptLine[];
  revealed?: number;
  phase?: TranscriptPhase;
}) {
  const colors = useThemeColors();
  const callerSpeaking =
    phase === TranscriptPhase.Live && revealed > 0 && lines[revealed - 1]?.speaker === "caller";

  return (
    <View className="gap-3">
      {lines.slice(0, revealed).map((entry, index) => {
        const isAgent = entry.speaker === "agent";
        const isActive = index === revealed - 1 && phase === TranscriptPhase.Live;
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
                <Mic size={10} strokeWidth={2} color={colors.muted} />
                <Text
                  className={`text-[10px] font-semibold uppercase tracking-[0.08em] ${
                    isAgent ? "text-muted-foreground" : "text-foreground"
                  }`}
                >
                  {entry.name}
                </Text>
                {entry.time && (
                  <Text font="mono" className="text-[10px] text-muted-foreground">
                    {entry.time}
                  </Text>
                )}
                {isActive && (
                  <View
                    className={`h-1.5 w-1.5 rounded-full ${
                      isAgent ? "bg-foreground/60" : "bg-green"
                    }`}
                  />
                )}
              </View>

              <Text className="mt-1 text-sm leading-snug text-foreground">
                {entry.original}
              </Text>

              {entry.translated && (
                <View className="mt-1.5 border-t border-border/60 pt-1.5">
                  <View className="flex-row items-center gap-1">
                    <Globe size={10} strokeWidth={2} color={colors.river} />
                    <Text className="text-[10px] font-medium uppercase tracking-[0.08em] text-river">
                      Translated
                    </Text>
                  </View>
                  <Text className="mt-0.5 text-sm leading-snug">
                    {entry.translated}
                  </Text>
                </View>
              )}
            </View>
          </View>
        );
      })}

      {phase === TranscriptPhase.Live && revealed < lines.length && (
        <View className={callerSpeaking ? "items-start" : "items-end"}>
          <View
            className={`flex-row items-center gap-1 rounded-2xl px-3.5 py-2.5 ${
              callerSpeaking
                ? "border border-border bg-secondary"
                : "border border-border bg-card"
            }`}
          >
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                className={`h-1.5 w-1.5 rounded-full ${
                  callerSpeaking ? "bg-foreground/40" : "bg-muted-foreground"
                }`}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
});
