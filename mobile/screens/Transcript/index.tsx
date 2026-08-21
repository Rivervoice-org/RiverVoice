import { ScrollView, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { ChevronLeft, Globe, Mic, User } from "lucide-react-native";
import { Rise } from "@/components/ui/rise";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/lib/theme";
import { TRANSCRIPT, type TranscriptEntry } from "./mock";

function TranscriptBubble({ entry }: { entry: TranscriptEntry }) {
  const colors = useThemeColors();
  const isAgent = entry.speaker === "agent";

  return (
    <View className={isAgent ? "items-end" : "items-start"}>
      <View
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
          isAgent
            ? "rounded-tr-md bg-foreground"
            : "rounded-tl-md bg-card border border-border"
        }`}
      >
        <View className="flex-row items-center gap-1.5">
          {isAgent ? (
            <Mic size={10} strokeWidth={2} color={colors.onInk} />
          ) : (
            <User size={10} strokeWidth={2} color={colors.muted} />
          )}
          <Text
            className={`text-[10px] font-semibold uppercase tracking-[0.08em] ${
              isAgent ? "text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {entry.name}
          </Text>
          <Text
            font="mono"
            className={`text-[10px] ${
              isAgent ? "text-primary-foreground/60" : "text-muted-foreground"
            }`}
          >
            {entry.time}
          </Text>
        </View>

        <Text
          className={`mt-1 text-sm leading-snug ${
            isAgent ? "text-primary-foreground" : "text-foreground"
          }`}
        >
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
            <Text className="mt-0.5 text-sm leading-snug">{entry.translated}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function TranscriptScreen() {
  const colors = useThemeColors();
  const params = useLocalSearchParams<{
    name: string;
    number: string;
    agent: string;
  }>();

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      {/* Header */}
      <Rise index={0}>
        <View className="flex-row items-center px-4 py-3">
          <Pressable
            onPress={() => router.back()}
            className="h-9 w-9 items-center justify-center rounded-lg active:bg-secondary"
            hitSlop={8}
          >
            <ChevronLeft size={22} strokeWidth={1.75} color={colors.ink} />
          </Pressable>
          <Text className="flex-1 text-center text-[17px] font-semibold">
            Transcription
          </Text>
          <View className="w-9" />
        </View>
      </Rise>

      {/* Caller info */}
      <Rise index={1}>
        <View className="px-5 pb-3">
          <Text className="text-[15px] font-semibold">
            {params.name || params.number}
          </Text>
          <Text variant="muted" className="text-xs">
            {params.agent ? `Handled by ${params.agent}` : "Direct call"}
          </Text>
        </View>
      </Rise>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-3">
          {TRANSCRIPT.map((entry, index) => (
            <TranscriptBubble key={index} entry={entry} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
