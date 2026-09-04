import { StyleSheet, View } from "react-native";
import { CallRow } from "@/components/CallRow";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

/** Same technique as screens/Home/skeleton.tsx's `TextLine`: an invisible
 * real `<Text>` reserves the exact line-box height React Native's font
 * metrics produce, with the visible bar centred over it — guessing a fixed
 * height makes the skeleton rows a different height than the real ones. */
function TextLine({
  className,
  bar,
  width,
}: {
  className: string;
  bar: string;
  width: string;
}) {
  return (
    <View>
      <Text aria-hidden className={cn("opacity-0", className)}>
        {" "}
      </Text>
      <View style={StyleSheet.absoluteFill} className="justify-center">
        <Skeleton className={cn("rounded-full", bar, width)} />
      </View>
    </View>
  );
}

/** One row, built from the real `CallRow` so the avatar size, gap, and
 * padding can't drift from what the loaded list actually draws. Nothing is
 * drawn in the trailing amount/time column — two small blocks against the
 * right edge reads as a broken glyph rather than as data waiting to
 * arrive, same reasoning Home's skeleton uses. */
function Row({
  title,
  subtitle,
  showDivider,
}: {
  title: string;
  subtitle: string;
  showDivider: boolean;
}) {
  return (
    <CallRow
      avatar={<Skeleton className="h-8 w-8 rounded-lg" />}
      title={
        <View className="min-w-0 flex-1">
          <TextLine className="text-sm font-medium" bar="h-2.5" width={title} />
        </View>
      }
      subtitle={<TextLine className="text-[11px]" bar="h-2" width={subtitle} />}
      showDivider={showDivider}
    />
  );
}

/** Widths per row, so a loading list reads as varied entries rather than a
 * repeating pattern. */
const ROWS = [
  ["w-2/5", "w-1/2"],
  ["w-1/2", "w-2/5"],
  ["w-1/3", "w-1/2"],
  ["w-2/5", "w-1/3"],
] as const;

const SECTION_LABEL_WIDTH = "w-16";

/** The transaction list while it loads. One card with dividers, matching
 * the real list's own card-with-dividers shape rather than separate
 * floating cards, plus a placeholder section-header line above it. */
export function CreditsHistorySkeleton() {
  return (
    <View className="mt-6">
      <View className="mx-5 mb-2">
        <Skeleton className={cn("h-2.5 rounded-full", SECTION_LABEL_WIDTH)} />
      </View>
      <View className="mx-5 overflow-hidden rounded-xl border border-border bg-card py-2">
        {ROWS.map(([title, subtitle], index) => (
          <Row
            key={title + subtitle}
            title={title}
            subtitle={subtitle}
            showDivider={index < ROWS.length - 1}
          />
        ))}
      </View>
    </View>
  );
}
