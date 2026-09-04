import { useCallback, useMemo } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  ChevronRight,
  Coins,
  CloudOff,
  Phone,
  PhoneOutgoing,
  RotateCw,
} from "lucide-react-native";
import { Mascot } from "@/components/Mascot";
import { CreateAgentPrompt } from "@/components/CreateAgentPrompt";
import { CallListItem, CallRow, type CallRowItem } from "@/components/CallRow";
import { SwipeToCallRow } from "@/components/SwipeToCallRow";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Rise, rowDelay } from "@/components/ui/rise";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/lib/theme";
import { useAuth } from "@/hooks/use-auth";
import { useRecentCalls } from "@/lib/calls/hooks";
import {
  buildContactIndex,
  relativeTime,
  toCallRowItem,
} from "@/lib/calls/format";
import { useRecentAgents } from "@/lib/agents/hooks";
import type { RecentAgent } from "@/lib/agents/types";
import { useContacts } from "@/state/contacts";
import { RecentAgentsSkeleton, RecentCallsSkeleton } from "./skeleton";

const CREDITS = {
  remaining: 3580,
  total: 12000,
  used: 8420,
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function callAgain(call: CallRowItem) {
  if (!call.agentId) return;
  router.push({
    pathname: "/in-call",
    params: {
      name: call.name,
      phone: call.number,
      agentId: call.agentId,
      agentName: call.agent ?? "Agent",
    },
  });
}

function openCallDetail(call: CallRowItem) {
  router.push({
    pathname: "/call-detail",
    params: { id: call.id, name: call.name },
  });
}

function getFormattedDate(): string {
  const now = new Date();
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]}`;
}

function RecentAgentRow({
  agent,
  index,
  showDivider,
}: {
  agent: RecentAgent;
  index: number;
  showDivider: boolean;
}) {
  const colors = useThemeColors();
  const calls = `${agent.callCount} ${agent.callCount === 1 ? "call" : "calls"}`;

  return (
    <Rise delay={rowDelay(2, index)}>
      <CallRow
        avatar={<Mascot ref={agent.mascot} seed={agent.name} size={32} />}
        title={agent.name}
        subtitle={`${calls} · ${relativeTime(agent.lastUsedAt)}`}
        trailing={
          <ChevronRight size={14} strokeWidth={1.75} color={colors.muted} />
        }
        showDivider={showDivider}
        onPress={() =>
          router.push({ pathname: "/agent-detail", params: { id: agent.id } })
        }
      />
    </Rise>
  );
}

function RecentAgentsSection() {
  const { data: agents, isLoading, isError } = useRecentAgents();

  if (isError || (!isLoading && !agents?.length)) return null;

  return (
    <View className="mt-8">
      <Rise index={2}>
        <View className="px-5">
          <Text
            variant="muted"
            className="text-[11px] font-medium uppercase tracking-[0.14em]"
          >
            Recently used agents
          </Text>
        </View>
      </Rise>

      {agents ? (
        <Card className="mx-5 mt-3 overflow-hidden">
          {agents.map((agent, index) => (
            <RecentAgentRow
              key={agent.id}
              agent={agent}
              index={index}
              showDivider={index < agents.length - 1}
            />
          ))}
        </Card>
      ) : (
        <RecentAgentsSkeleton />
      )}
    </View>
  );
}

function HomeHeader({
  name,
  hasCalls,
}: {
  name: string | null;
  hasCalls: boolean;
}) {
  const colors = useThemeColors();

  return (
    <>
      <Rise index={0}>
        <View className="px-5 pt-4 pb-2">
          <Text className="text-[28px] font-semibold leading-tight tracking-[-0.02em]">
            {name ? `${getGreeting()}, ${name}` : getGreeting()}
          </Text>
          <Text variant="muted" className="mt-1.5 text-sm">
            {getFormattedDate()}
          </Text>
        </View>
      </Rise>

      {/* Credits. Mocked: nothing on ferry reports a balance yet, so these
          figures are fixed until an endpoint exists to replace CREDITS
          with. Reads as a balance rather than a usage meter — what is left
          is the number that decides whether you can place a call. */}
      <Rise index={1}>
        <Pressable
          onPress={() => router.push("/credits-history")}
          className="mx-5 mt-4 active:opacity-80"
        >
          <Card className="p-4">
            <View className="flex-row items-center justify-between">
              <Text
                variant="muted"
                className="text-[11px] font-medium uppercase tracking-[0.14em]"
              >
                Credits
              </Text>
              <View className="flex-row items-center gap-1">
                <Coins size={14} strokeWidth={1.75} color={colors.muted} />
                <ChevronRight
                  size={14}
                  strokeWidth={1.75}
                  color={colors.muted}
                />
              </View>
            </View>

            <View className="mt-3 flex-row items-baseline gap-1.5">
              <Text font="mono" className="text-lg font-semibold">
                {CREDITS.remaining.toLocaleString()}
              </Text>
              <Text variant="muted" className="text-sm">
                of {CREDITS.total.toLocaleString()}
              </Text>
            </View>

            {/* Fills with what is left, not what is spent, so a nearly empty
                balance reads as a nearly empty bar. */}
            <Progress
              value={(CREDITS.remaining / CREDITS.total) * 100}
              className="mt-2.5"
            />

            <Text variant="muted" className="mt-2 text-xs">
              {CREDITS.used.toLocaleString()} credits used this month
            </Text>
          </Card>
        </Pressable>
      </Rise>

      <RecentAgentsSection />

      {/* Recent Calls */}
      <View className="mt-8">
        <Rise index={3}>
          <View className="px-5">
            <Text
              variant="muted"
              className="text-[11px] font-medium uppercase tracking-[0.14em]"
            >
              Recent calls
            </Text>
          </View>
        </Rise>
      </View>

      {hasCalls ? (
        <View className="mx-5 mt-3 h-2 rounded-t-xl border-x border-t border-border bg-card" />
      ) : null}
    </>
  );
}

export default function HomeScreen() {
  const colors = useThemeColors();
  const { user } = useAuth();
  const firstName = user?.name.trim().split(/\s+/)[0] ?? null;
  const { contacts } = useContacts();
  const {
    calls,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useRecentCalls();

  const contactNames = useMemo(() => buildContactIndex(contacts), [contacts]);
  const rows = useMemo(
    () => calls.map((call) => toCallRowItem(call, contactNames)),
    [calls, contactNames],
  );

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = useCallback(
    ({ item, index }: { item: CallRowItem; index: number }) => (
      <View className="mx-5 border-x border-border bg-card">
        <Rise delay={rowDelay(3, Math.min(index, 5))}>
          {item.agentId ? (
            <SwipeToCallRow onCall={() => callAgain(item)}>
              <CallListItem
                call={item}
                showDivider={index < rows.length - 1}
                onPress={() => openCallDetail(item)}
              />
            </SwipeToCallRow>
          ) : (
            <CallListItem
              call={item}
              showDivider={index < rows.length - 1}
              onPress={() => openCallDetail(item)}
            />
          )}
        </Rise>
      </View>
    ),
    [rows.length],
  );

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
          />
        }
        ListHeaderComponent={
          <HomeHeader name={firstName} hasCalls={rows.length > 0} />
        }
        ListEmptyComponent={
          isLoading ? (
            <RecentCallsSkeleton />
          ) : (
            <View className="mx-5 mt-3 items-center rounded-xl border border-border bg-card px-5 py-12">
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
                    Couldn&apos;t load your calls
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
                    <Phone size={20} strokeWidth={1.75} color={colors.faint} />
                  </View>
                  <Text className="mt-3 text-center text-sm font-medium">
                    No calls yet
                  </Text>
                  <Text variant="muted" className="mt-1 text-center text-xs">
                    Calls you make with an agent will show up here.
                  </Text>
                  <Button
                    size="sm"
                    className="mt-4"
                    onPress={() => router.navigate("/call")}
                  >
                    <PhoneOutgoing
                      size={14}
                      strokeWidth={2}
                      color={colors.onInk}
                    />
                    <Text className="text-xs font-medium text-primary-foreground">
                      Start a call
                    </Text>
                  </Button>
                </>
              )}
            </View>
          )
        }
        ListFooterComponent={
          <>
            {rows.length > 0 ? (
              <View className="mx-5 h-2 rounded-b-xl border-x border-b border-border bg-card" />
            ) : null}
            {isFetchingNextPage ? (
              <View className="items-center py-5">
                <Spinner size={18} />
              </View>
            ) : null}
          </>
        }
      />
      <CreateAgentPrompt />
    </SafeAreaView>
  );
}
