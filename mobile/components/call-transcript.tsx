import { memo, type ReactNode } from "react";
import { View } from "react-native";
import { Languages } from "lucide-react-native";
import { TypingDots } from "@/components/TypingDots";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { useThemeColors } from "@/lib/theme";

/**
 * One turn of a call, in the shape both the finished transcript and the live
 * captions can supply.
 *
 * `text` is always what *you* read. `spoken` is the same turn in the other
 * language — what the other side heard for your lines, what they actually
 * said for theirs — and is null when only one language is known, which is
 * the case for every line of a live call.
 */
export type CallTranscriptLine = {
  key: string;
  /** Right-aligned, dark bubble. False puts it on the left. */
  mine: boolean;
  text: string;
  spoken?: string | null;
  /** Offset from the call's start, already formatted. */
  time?: string | null;
};

/**
 * One bubble.
 *
 * Memoized separately from the list because live captions append to it while
 * it is on screen: without the split, each arriving line re-renders every
 * bubble above it.
 */
export const CallTranscriptBubble = memo(function CallTranscriptBubble({
  line,
  showSpoken,
}: {
  line: CallTranscriptLine;
  showSpoken: boolean;
}) {
  const colors = useThemeColors();
  const { mine, text, spoken, time } = line;
  const reveal = showSpoken && spoken && spoken !== text;

  return (
    <View className={mine ? "items-end" : "items-start"}>
      <View
        className={cn(
          "max-w-[82%] rounded-2xl px-3.5 py-2.5",
          mine
            ? "rounded-br-md bg-foreground"
            : "rounded-bl-md border border-border bg-card",
        )}
      >
        <Text
          className={cn(
            "text-[15px] leading-snug",
            mine ? "text-primary-foreground" : "text-foreground",
          )}
        >
          {text}
        </Text>

        {reveal ? (
          <View
            className={cn(
              "mt-2 border-t pt-2",
              mine ? "border-white/15" : "border-border",
            )}
          >
            <View className="flex-row items-center gap-1">
              <Languages
                size={10}
                strokeWidth={2}
                color={mine ? colors.onInk : colors.river}
              />
              <Text
                className={cn(
                  "text-[10px] font-medium uppercase tracking-[0.08em]",
                  mine ? "text-primary-foreground/70" : "text-river",
                )}
              >
                {mine ? "They heard" : "They said"}
              </Text>
            </View>
            <Text
              className={cn(
                "mt-0.5 text-[13px] leading-snug",
                mine ? "text-primary-foreground/70" : "text-muted-foreground",
              )}
            >
              {spoken}
            </Text>
          </View>
        ) : null}
      </View>

      {time ? (
        <Text font="mono" variant="muted" className="mt-1 px-1 text-[10px]">
          {time}
        </Text>
      ) : null}
    </View>
  );
});

/**
 * A conversation, as chat bubbles. You always read the call in your own
 * language: your bubbles are what you said, theirs are what you heard, and
 * `showSpoken` reveals the other language underneath. Because each line
 * carries both, the same conversation reads as a single-language thread
 * from either side of the call.
 *
 * The one renderer for both a finished call (`screens/Transcript`, from the
 * persisted utterances) and a call in progress (`screens/InCall`'s captions,
 * from the data channel). Live callers pass `interim` for the partial
 * caption that has not been finalised yet; a finished transcript has no such
 * thing and leaves it out.
 */
export function CallTranscript({
  lines,
  showSpoken = false,
  interim,
  footer,
}: {
  lines: CallTranscriptLine[];
  showSpoken?: boolean;
  /** Words heard but not yet final, drawn as an unsettled bubble. */
  interim?: string;
  /** Anything to hang below the last bubble. */
  footer?: ReactNode;
}) {
  const colors = useThemeColors();

  return (
    <View className="gap-3">
      {lines.map((line) => (
        <CallTranscriptBubble
          key={line.key}
          line={line}
          showSpoken={showSpoken}
        />
      ))}

      {interim ? (
        <View className="items-end">
          <View className="max-w-[82%] rounded-2xl rounded-br-md bg-foreground/70 px-3.5 py-2.5">
            <Text className="text-[15px] leading-snug text-primary-foreground">
              {interim}
            </Text>
            <View className="mt-1 flex-row items-center gap-1.5">
              <TypingDots color={colors.onInk} size={4} />
            </View>
          </View>
        </View>
      ) : null}

      {footer}
    </View>
  );
}
