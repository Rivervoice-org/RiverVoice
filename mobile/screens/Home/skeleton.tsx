import { View } from "react-native";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Placeholder bar widths, one `[title, subtitle]` pair per row. Varied so a
 * loading list reads as a list of names rather than a striped pattern.
 */
const AGENT_ROW_WIDTHS: readonly (readonly [string, string])[] = [
  ["w-2/5", "w-1/3"],
  ["w-1/3", "w-2/5"],
  ["w-1/2", "w-1/4"],
];

const CALL_ROW_WIDTHS = ["w-2/5", "w-1/3", "w-1/2", "w-2/5"] as const;

/**
 * One row of the `CallRow` anatomy: 32px avatar, name, the line under it,
 * and something trailing. Both lists on this screen are built from it, at
 * the same paddings as the real rows, so neither resizes when its data
 * arrives — only the contents change.
 */
function Row({
  title,
  subtitle,
  trailing,
  showDivider,
}: {
  title: string;
  subtitle: string;
  trailing: string;
  showDivider: boolean;
}) {
  return (
    <View
      className={cn(
        "flex-row items-center gap-3 px-4 py-3",
        showDivider && "border-b border-border",
      )}
    >
      <Skeleton className="h-8 w-8 rounded-full" />
      <View className="flex-1 gap-1.5">
        <Skeleton className={cn("h-3 rounded-full", title)} />
        <Skeleton className={cn("h-2.5 rounded-full", subtitle)} />
      </View>
      <Skeleton className={cn("h-2.5 rounded-full", trailing)} />
    </View>
  );
}

/**
 * The recently-used agents card while it loads. Three rows because three is
 * the most `/v1/agents/recent` can return — the card can only shrink from
 * here when the real agents land, never jump taller.
 */
export function RecentAgentsSkeleton() {
  return (
    <Card className="mx-5 mt-3 overflow-hidden">
      {AGENT_ROW_WIDTHS.map(([title, subtitle], index) => (
        <Row
          key={title + subtitle}
          title={title}
          subtitle={subtitle}
          trailing="w-3.5"
          showDivider={index < AGENT_ROW_WIDTHS.length - 1}
        />
      ))}
    </Card>
  );
}

/**
 * The call list while its first page loads. Four rows rather than a full
 * screen of them: the list is unbounded, so this is a hint that rows are
 * coming, not a promise of how many.
 */
export function RecentCallsSkeleton() {
  return (
    <View className="w-full px-4 py-1">
      {CALL_ROW_WIDTHS.map((title, index) => (
        <Row
          key={title + index}
          title={title}
          subtitle="w-1/3"
          trailing="w-10"
          showDivider={index < CALL_ROW_WIDTHS.length - 1}
        />
      ))}
    </View>
  );
}
