import { useState } from "react";
import { ScrollView, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft, Languages } from "lucide-react-native";
import { InitialsAvatar } from "@/components/InitialsAvatar";
import { Rise } from "@/components/ui/rise";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { useThemeColors } from "@/lib/theme";
import { CALL, UTTERANCES, type UtteranceRow } from "./mock";

function formatOffset(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * You always read the call in your own language. Your own lines are what you
 * said (`originalText`); their lines are what you heard (`translatedText`).
 */
function Bubble({
  row,
  showOriginal,
}: {
  row: UtteranceRow;
  showOriginal: boolean;
}) {
  const colors = useThemeColors();
  const isMine = row.speaker === "caller";
  const text = isMine ? row.originalText : (row.translatedText ?? row.originalText);
  const spoken = isMine ? row.translatedText : row.originalText;
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

      <Text font="mono" variant="muted" className="mt-1 px-1 text-[10px]">
        {formatOffset(row.offsetMs)}
      </Text>
    </View>
  );
}

export default function CallChatPreviewScreen() {
  const colors = useThemeColors();
  const [showOriginal, setShowOriginal] = useState(false);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <Rise index={0}>
        <View className="flex-row items-center gap-3 px-4 py-3">
          <Pressable
            onPress={() => router.back()}
            className="h-9 w-9 items-center justify-center rounded-lg active:bg-secondary"
            hitSlop={8}
          >
            <ChevronLeft size={22} strokeWidth={1.75} color={colors.ink} />
          </Pressable>

          <InitialsAvatar name={CALL.contactName} size={36} />

          <View className="flex-1">
            <Text className="text-[15px] font-semibold">
              {CALL.contactName}
            </Text>
            <Text variant="muted" className="text-xs">
              {CALL.agentName} · {formatOffset(CALL.billableSeconds * 1000)}
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

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 40,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-3">
          {UTTERANCES.map((row) => (
            <Bubble key={row.seq} row={row} showOriginal={showOriginal} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
