import { useState } from "react";
import { ScrollView, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { ChevronLeft, Languages } from "lucide-react-native";
import { Rise } from "@/components/ui/rise";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { useThemeColors } from "@/lib/theme";
import { useCallDetail } from "@/lib/calls/hooks";
import type { Utterance } from "@/lib/calls/types";

function formatOffset(ms: number | null): string {
  if (ms === null) return "";
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * You always read the call in your own language: your own lines are what you
 * said (`originalText`), theirs are what you heard (`translatedText`).
 * Because every row stores both, the same rows would read as a pure
 * English thread from the other side.
 */
function Bubble({
  line,
  showOriginal,
}: {
  line: Utterance;
  showOriginal: boolean;
}) {
  const colors = useThemeColors();
  const isMine = line.speaker === "caller";
  const text = isMine ? line.originalText : (line.translatedText ?? line.originalText);
  const spoken = isMine ? line.translatedText : line.originalText;
  const reveal = showOriginal && spoken && spoken !== text;

  return (
    <View className={isMine ? "items-end" : "items-start"}>
      <View
        className={cn(
          "max-w-[82%] rounded-2xl px-3.5 py-2.5",
          isMine
            ? "rounded-br-md bg-foreground"
            : "rounded-bl-md border border-border bg-card",
        )}
      >
        <Text
          className={cn(
            "text-[15px] leading-snug",
            isMine ? "text-primary-foreground" : "text-foreground",
          )}
        >
          {text}
        </Text>

        {reveal ? (
          <View
            className={cn(
              "mt-2 border-t pt-2",
              isMine ? "border-white/15" : "border-border",
            )}
          >
            <View className="flex-row items-center gap-1">
              <Languages
                size={10}
                strokeWidth={2}
                color={isMine ? colors.onInk : colors.river}
              />
              <Text
                className={cn(
                  "text-[10px] font-medium uppercase tracking-[0.08em]",
                  isMine ? "text-primary-foreground/70" : "text-river",
                )}
              >
                {isMine ? "They heard" : "They said"}
              </Text>
            </View>
            <Text
              className={cn(
                "mt-0.5 text-[13px] leading-snug",
                isMine ? "text-primary-foreground/70" : "text-muted-foreground",
              )}
            >
              {spoken}
            </Text>
          </View>
        ) : null}
      </View>

      {line.offsetMs !== null ? (
        <Text font="mono" variant="muted" className="mt-1 px-1 text-[10px]">
          {formatOffset(line.offsetMs)}
        </Text>
      ) : null}
    </View>
  );
}

export default function TranscriptScreen() {
  const colors = useThemeColors();
  const params = useLocalSearchParams<{ id: string; name?: string }>();
  const { data: call, isLoading, isError, error } = useCallDetail(params.id);
  const [showOriginal, setShowOriginal] = useState(false);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <Rise index={0}>
        <View className="flex-row items-center px-4 py-3">
          <Pressable
            onPress={() => router.back()}
            className="h-9 w-9 items-center justify-center rounded-lg active:bg-secondary"
            hitSlop={8}
          >
            <ChevronLeft size={22} strokeWidth={1.75} color={colors.ink} />
          </Pressable>

          <View className="flex-1">
            <Text className="text-center text-[17px] font-semibold">
              Transcription
            </Text>
          </View>

          <Pressable
            onPress={() => setShowOriginal((v) => !v)}
            hitSlop={8}
            className={cn(
              "h-9 w-9 items-center justify-center rounded-lg active:opacity-70",
              showOriginal ? "bg-foreground" : "bg-secondary",
            )}
          >
            <Languages
              size={16}
              strokeWidth={1.75}
              color={showOriginal ? colors.onInk : colors.muted}
            />
          </Pressable>
        </View>
      </Rise>

      {call ? (
        <Rise index={1}>
          <View className="px-5 pb-3">
            <Text className="text-[15px] font-semibold">
              {params.name || call.toNumber}
            </Text>
            <Text variant="muted" className="text-xs">
              {call.agentName ? `Handled by ${call.agentName}` : "Direct call"}
            </Text>
          </View>
        </Rise>
      ) : null}

      {isLoading || isError || !call ? (
        <View className="flex-1 items-center justify-center px-10">
          {isLoading ? (
            <Spinner size={22} />
          ) : (
            <Text variant="muted" className="text-center text-sm">
              {error instanceof Error
                ? error.message
                : "Couldn't load this transcript"}
            </Text>
          )}
        </View>
      ) : call.utterances.length === 0 ? (
        <View className="flex-1 items-center justify-center px-10">
          <Text variant="muted" className="text-center text-sm">
            No transcript for this call
          </Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 4,
            paddingBottom: 40,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View className="gap-3">
            {call.utterances.map((line) => (
              <Bubble key={line.seq} line={line} showOriginal={showOriginal} />
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
