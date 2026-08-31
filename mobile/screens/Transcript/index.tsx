import { useCallback, useMemo, useRef, useState } from "react";
import {
  ScrollView,
  View,
  Pressable,
  type LayoutChangeEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { ChevronLeft, Languages } from "lucide-react-native";
import { RecordingPlayer } from "@/components/RecordingPlayer";
import { Rise } from "@/components/ui/rise";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { useThemeColors } from "@/lib/theme";
import { useCallDetail } from "@/lib/calls/hooks";
import { useRecordingPlayer } from "@/lib/calls/use-recording-player";
import {
  CallTranscriptBubble,
  type CallTranscriptLine,
} from "@/components/call-transcript";
import {
  Speaker,
  turnSpan,
  type RecordingVariant,
  type Utterance,
} from "@/lib/calls/types";

/**
 * A persisted utterance as the shared renderer wants it. `caller` is the app
 * user, so their `originalText` is what they said and the translation is what
 * the other side heard; for `callee` those roles swap, which is what keeps
 * the whole thread in one language.
 */
function toLine(
  line: Utterance,
  variant: RecordingVariant,
  activeSeq: number | null,
  onLinePress: (seq: number, offsetMs: number) => void,
): CallTranscriptLine {
  const mine = line.speaker === Speaker.Caller;
  const span = turnSpan(line, variant);
  return {
    key: String(line.seq),
    mine,
    text: mine ? line.originalText : (line.translatedText ?? line.originalText),
    spoken: mine ? line.translatedText : line.originalText,
    time: line.offsetMs === null ? null : formatOffset(line.offsetMs),
    active: activeSeq === line.seq,
    onPress:
      span.offsetMs === null
        ? undefined
        : () => onLinePress(line.seq, span.offsetMs ?? 0),
  };
}

function formatOffset(ms: number | null): string {
  if (ms === null) return "";
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function TranscriptScreen() {
  const colors = useThemeColors();
  const params = useLocalSearchParams<{ id: string; name?: string }>();
  const { data: call, isLoading, isError, error } = useCallDetail(params.id);
  const [showOriginal, setShowOriginal] = useState(false);
  const player = useRecordingPlayer(call);

  const scrollRef = useRef<ScrollView>(null);
  const linePositions = useRef<Map<string, number>>(new Map());

  // The utterance whose span in the currently-playing recording contains the
  // current playback position — karaoke-style highlight, and what drives
  // auto-scroll below.
  const activeSeq = useMemo(() => {
    if (!call || !player.isPlaying) return null;
    for (const utterance of call.utterances) {
      const span = turnSpan(utterance, player.variant);
      if (span.offsetMs === null || span.durationMs === null) continue;
      const start = span.offsetMs;
      const end = span.offsetMs + span.durationMs;
      if (player.positionMs >= start && player.positionMs < end) {
        return utterance.seq;
      }
    }
    return null;
  }, [call, player.isPlaying, player.positionMs, player.variant]);

  const handleLineLayout = useCallback(
    (key: string) => (event: LayoutChangeEvent) => {
      linePositions.current.set(key, event.nativeEvent.layout.y);
    },
    [],
  );

  useMemo(() => {
    if (activeSeq === null) return;
    const y = linePositions.current.get(String(activeSeq));
    if (y === undefined) return;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 80), animated: true });
    // Runs as a side effect of activeSeq changing, not a value derivation —
    // useMemo here is just "run this when activeSeq changes", not memoizing
    // a return value (there isn't one).
  }, [activeSeq]);

  const handleLinePress = useCallback(
    (_seq: number, offsetMs: number) => {
      player.seekToMs(offsetMs);
    },
    [player],
  );

  const lines = call?.utterances.map((u) =>
    toLine(u, player.variant, activeSeq, handleLinePress),
  );

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
          {player.hasAudio ? (
            <View className="px-5 pb-3">
              <RecordingPlayer
                hasAudio={player.hasAudio}
                hasTranslated={player.hasTranslated}
                variant={player.variant}
                onVariantChange={player.setVariant}
                isPlaying={player.isPlaying}
                positionMs={player.positionMs}
                durationMs={player.durationMs}
                onToggle={player.toggle}
              />
            </View>
          ) : null}
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
          ref={scrollRef}
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 4,
            paddingBottom: 40,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View className="gap-3">
            {lines?.map((line) => (
              <View key={line.key} onLayout={handleLineLayout(line.key)}>
                <CallTranscriptBubble line={line} showSpoken={showOriginal} />
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
