import { StyleSheet, View } from "react-native";
import { CallRow } from "@/components/CallRow";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

/**
 * A placeholder bar that occupies exactly the line box of the text it
 * stands in for.
 *
 * The real `<Text>` is rendered underneath at zero opacity, carrying the
 * same typography classes, so the row reserves the height React Native's
 * font metrics actually produce — guessing at it with a fixed `h-3` made
 * the skeleton rows shorter than the real ones, and the whole list jumped
 * when the data landed. The bar itself is then centred over that box.
 */
function TextLine({
  text,
  bar,
  width,
  className,
}: {
  /** Typography classes of the line being replaced. */
  className: string;
  /** Height of the visible bar, e.g. "h-2.5". */
  bar: string;
  width: string;
  text?: string;
}) {
  return (
    <View>
      <Text aria-hidden className={cn("opacity-0", className)}>
        {text ?? " "}
      </Text>
      <View style={StyleSheet.absoluteFill} className="justify-center">
        <Skeleton className={cn("rounded-full", bar, width)} />
      </View>
    </View>
  );
}

/**
 * One row, built from the same `CallRow` the real lists use rather than a
 * hand-copied approximation of it — the avatar size, the `gap-3`, the
 * `px-4 py-3` and the two-line column all come from the component itself,
 * so they cannot drift out of step with it.
 *
 * Nothing is drawn in the trailing slot. The real one holds a timestamp and
 * a chevron, but two small blocks stacked against the right edge read as a
 * broken glyph rather than as text waiting to arrive, and the column is
 * narrow enough that leaving it empty costs no layout shift.
 */
function Row({
  round,
  title,
  subtitle,
  showDivider,
}: {
  /** Calls use a rounded square, agents a circular mascot. */
  round: "rounded-lg" | "rounded-full";
  title: string;
  subtitle: string;
  showDivider: boolean;
}) {
  return (
    <CallRow
      avatar={<Skeleton className={cn("h-8 w-8", round)} />}
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

/** Widths per row, so a loading list reads as names rather than a pattern. */
const AGENT_ROWS = [
  ["w-2/5", "w-1/2"],
  ["w-1/3", "w-2/5"],
  ["w-1/2", "w-1/3"],
] as const;

const CALL_ROWS = [
  ["w-3/5", "w-4/5"],
  ["w-1/2", "w-3/5"],
  ["w-3/5", "w-3/4"],
  ["w-2/5", "w-2/3"],
] as const;

/**
 * The recently-used agents card while it loads. Three rows because three is
 * the most `/v1/agents/recent` can return — the card can only shrink when
 * the real agents land, never jump taller.
 */
export function RecentAgentsSkeleton() {
  return (
    <Card className="mx-5 mt-3 overflow-hidden">
      {AGENT_ROWS.map(([title, subtitle], index) => (
        <Row
          key={title + subtitle}
          round="rounded-full"
          title={title}
          subtitle={subtitle}
          showDivider={index < AGENT_ROWS.length - 1}
        />
      ))}
    </Card>
  );
}

/**
 * The call list while its first page loads. Four rows rather than a screenful:
 * the list is unbounded, so this hints that rows are coming without promising
 * how many.
 */
export function RecentCallsSkeleton() {
  return (
    // The real list draws this card in three pieces — an 8px top cap, the
    // bordered rows, an 8px bottom cap — because its rows are FlatList
    // children and cannot share a parent. Nothing forces that here, and
    // stitching three views together left hairlines where they met, so this
    // is one card with the caps' 8px reproduced as padding.
    <View className="mx-5 mt-3 overflow-hidden rounded-xl border border-border bg-card py-2">
      {CALL_ROWS.map(([title, subtitle], index) => (
        <View key={title + subtitle + index}>
          <Row
            round="rounded-lg"
            title={title}
            subtitle={subtitle}
            showDivider={index < CALL_ROWS.length - 1}
          />
        </View>
      ))}
    </View>
  );
}
