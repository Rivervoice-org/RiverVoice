import { Pressable, SectionList, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  ChevronLeft,
  CloudOff,
  Coins,
  Phone,
  PlusCircle,
  RotateCw,
} from "lucide-react-native";
import { CallRow } from "@/components/CallRow";
import { Mascot } from "@/components/Mascot";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Rise, rowDelay } from "@/components/ui/rise";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/lib/theme";
import { languageLabel } from "@/lib/calls/format";
import { entryTypeLabel, stageLabel } from "@/lib/credits/format";
import { useCreditBalance, useCreditHistory } from "@/lib/credits/hooks";
import type { CreditHistoryEntry } from "@/lib/credits/types";
import { cn } from "@/lib/utils";
import { CreditsHistorySkeleton } from "./skeleton";

/** Local calendar-date grouping key — year included, unlike `dateLabel`'s
 * display string, so two entries a whole number of years apart (same
 * weekday, day, and month) don't collide into one section. */
function dateKey(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function dateLabel(iso: string, now: number = Date.now()): string {
  const date = new Date(iso);
  const days = Math.floor(
    (new Date(now).setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) /
      86_400_000,
  );
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" as const }),
  });
}

function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function groupByDate(entries: CreditHistoryEntry[]) {
  const order: string[] = [];
  const byKey = new Map<
    string,
    { label: string; data: CreditHistoryEntry[] }
  >();
  for (const entry of entries) {
    const key = dateKey(entry.createdAt);
    let group = byKey.get(key);
    if (!group) {
      group = { label: dateLabel(entry.createdAt), data: [] };
      byKey.set(key, group);
      order.push(key);
    }
    group.data.push(entry);
  }
  return order.map((key) => {
    const group = byKey.get(key);
    return { title: group?.label ?? key, data: group?.data ?? [] };
  });
}

function TransactionRow({
  entry,
  index,
  showDivider,
}: {
  entry: CreditHistoryEntry;
  index: number;
  showDivider: boolean;
}) {
  const colors = useThemeColors();
  const isCredit = entry.amountCredits > 0;

  let avatar: React.ReactNode;
  let title: string;
  let subtitle: string | undefined;

  if (entry.entryType !== "charge") {
    avatar = (
      <View className="h-8 w-8 items-center justify-center rounded-lg bg-green-tint">
        <PlusCircle size={14} strokeWidth={1.75} color={colors.green} />
      </View>
    );
    title = entryTypeLabel(entry.entryType);
    subtitle = undefined;
  } else if (entry.isCallSummary) {
    avatar = (
      <View className="h-8 w-8 items-center justify-center rounded-lg bg-secondary">
        <Phone size={14} strokeWidth={1.75} color={colors.muted} />
      </View>
    );
    title = entry.agentName ?? "Direct call";
    subtitle =
      languageLabel(entry.inputLanguage, entry.outputLanguage) || "Phone call";
  } else {
    // Not a call summary — a try-agent charge (no call_id to group by), or
    // defensively, any other standalone charge shape.
    avatar = <Mascot seed="try-agent" size={32} />;
    title = "Try agent";
    subtitle = stageLabel(entry.stage);
  }

  return (
    <Rise delay={rowDelay(1, index)}>
      <CallRow
        avatar={avatar}
        title={title}
        subtitle={subtitle}
        trailing={
          <View className="items-end">
            <Text
              font="mono"
              className="text-sm font-semibold tabular-nums"
              variant={isCredit ? "default" : "destructive"}
              style={isCredit ? { color: colors.green } : undefined}
            >
              {isCredit ? "+" : ""}
              {entry.amountCredits.toLocaleString()}
            </Text>
            <Text variant="muted" className="mt-0.5 text-[11px]">
              {clockTime(entry.createdAt)}
            </Text>
          </View>
        }
        showDivider={showDivider}
      />
    </Rise>
  );
}

export default function CreditsHistoryScreen() {
  const colors = useThemeColors();
  const { data: balance, isLoading: isBalanceLoading } = useCreditBalance();
  const {
    entries: history,
    isLoading: isHistoryLoading,
    isError,
    error,
    refetch,
    isRefetching,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useCreditHistory();

  const sections = groupByDate(history);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <View className="flex-row items-center px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          className="h-9 w-9 items-center justify-center rounded-lg active:bg-secondary"
          hitSlop={8}
        >
          <ChevronLeft size={22} strokeWidth={1.75} color={colors.ink} />
        </Pressable>
        <Text className="flex-1 text-center text-[17px] font-semibold">
          Credits
        </Text>
        <View className="w-9" />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        ListHeaderComponent={
          <Rise index={0}>
            <Card className="mx-5 mt-1 p-4">
              <View className="flex-row items-center justify-between">
                <Text
                  variant="muted"
                  className="text-[11px] font-medium uppercase tracking-[0.14em]"
                >
                  Balance
                </Text>
                <Coins size={14} strokeWidth={1.75} color={colors.muted} />
              </View>

              <View className="mt-3 flex-row items-baseline gap-1.5">
                {isBalanceLoading ? (
                  <Skeleton className="h-5 w-16 rounded-full" />
                ) : (
                  <Text font="mono" className="text-lg font-semibold">
                    {(balance?.remaining ?? 0).toLocaleString()}
                  </Text>
                )}
                <Text variant="muted" className="text-sm">
                  credits remaining
                </Text>
              </View>

              <Button
                size="sm"
                className="mt-4"
                onPress={() => router.push("/recharge")}
              >
                <PlusCircle size={14} strokeWidth={2} color={colors.onInk} />
                <Text className="text-xs font-medium text-primary-foreground">
                  Recharge
                </Text>
              </Button>
            </Card>
          </Rise>
        }
        renderSectionHeader={({ section: { title } }) => (
          <View className="mx-5 mb-2 mt-6 px-0">
            <Text
              variant="muted"
              className="text-[11px] font-medium uppercase tracking-[0.14em]"
            >
              {title}
            </Text>
          </View>
        )}
        renderItem={({ item, index, section }) => (
          <View
            className={cn(
              "mx-5 border-x border-border bg-card",
              index === 0 && "rounded-t-xl border-t",
              index === section.data.length - 1 && "rounded-b-xl border-b",
            )}
          >
            <TransactionRow
              entry={item}
              index={index}
              showDivider={index < section.data.length - 1}
            />
          </View>
        )}
        onRefresh={() => void refetch()}
        refreshing={isRefetching}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View className="items-center py-5">
              <Spinner size={18} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          isHistoryLoading ? (
            <CreditsHistorySkeleton />
          ) : (
            <View className="mx-5 mt-6 items-center rounded-xl border border-border bg-card px-5 py-12">
              {isError ? (
                <>
                  <View className="h-11 w-11 items-center justify-center rounded-full bg-destructive/10">
                    <CloudOff
                      size={20}
                      strokeWidth={1.75}
                      color={colors.destructive}
                    />
                  </View>
                  <Text className="mt-3 text-center text-sm font-medium">
                    Couldn&apos;t load your credits history
                  </Text>
                  {error instanceof Error ? (
                    <Text variant="muted" className="mt-1 text-center text-xs">
                      {error.message}
                    </Text>
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-4"
                    onPress={() => void refetch()}
                  >
                    <RotateCw size={14} strokeWidth={2} color={colors.muted} />
                    <Text className="text-xs font-medium text-foreground">
                      Try again
                    </Text>
                  </Button>
                </>
              ) : (
                <>
                  <View className="h-11 w-11 items-center justify-center rounded-full bg-border">
                    <Coins size={20} strokeWidth={1.75} color={colors.faint} />
                  </View>
                  <Text className="mt-3 text-center text-sm font-medium">
                    No credits activity yet
                  </Text>
                  <Text variant="muted" className="mt-1 text-center text-xs">
                    Calls and recharges will show up here.
                  </Text>
                </>
              )}
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}
