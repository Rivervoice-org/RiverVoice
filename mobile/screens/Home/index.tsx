import { useCallback, useMemo } from "react";
import { FlatList, RefreshControl, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronRight, Clock } from "lucide-react-native";
import { Mascot } from "@/components/Mascot";
import { CallListItem, CallRow, type CallRowItem } from "@/components/CallRow";
import { SwipeToCallRow } from "@/components/SwipeToCallRow";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Rise, rowDelay } from "@/components/ui/rise";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/lib/theme";
import { useAuth } from "@/hooks/use-auth";
import { useRecentCalls } from "@/lib/calls/hooks";
import { buildContactIndex, toCallRowItem } from "@/lib/calls/format";
import { useContacts } from "@/state/contacts";
import { ACTIVE_AGENTS } from "./mock";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function callAgain(call: CallRowItem) {
  router.push({
    pathname: "/in-call",
    params: {
      name: call.name,
      phone: call.number,
      agentId: `recall-${call.id}`,
      agentName: call.agent ?? "Agent",
    },
  });
}

/** Only the id travels: the detail screen fetches the call itself, so the
 * route can't carry a stale copy of fields the server owns. `name` rides
 * along purely because it comes from the device address book, which the
 * server has never seen. */
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

/**
 * Everything above the call list. It rides in `ListHeaderComponent` rather
 * than sitting in a ScrollView above the list, because a FlatList nested in a
 * ScrollView loses virtualization — and this list is now unbounded.
 */
function HomeHeader({
  isAuthenticated,
  hasCalls,
}: {
  isAuthenticated: boolean;
  hasCalls: boolean;
}) {
  const colors = useThemeColors();

  return (
    <>
      <Rise index={0}>
        <View className="px-5 pt-4 pb-2">
          <Text className="text-[28px] font-semibold leading-tight tracking-[-0.02em]">
            {getGreeting()}, Pavan
          </Text>
          <Text variant="muted" className="mt-1.5 text-sm">
            {getFormattedDate()}
          </Text>
        </View>
      </Rise>

      {/* Minutes Used */}
      {isAuthenticated ? (
        <Rise index={1}>
          {/* Temporary entry point to the transcript-chat preview
              (screens/CallChatPreview) while the call schema is being
              designed. Drop this Pressable when the real screen lands. */}
          <Pressable
            onPress={() => router.push("/call-chat-preview")}
            className="active:opacity-70"
          >
            <Card className="mx-5 mt-4 p-4">
              <View className="flex-row items-center justify-between">
                <Text
                  variant="muted"
                  className="text-[11px] font-medium uppercase tracking-[0.14em]"
                >
                  Minutes used
                </Text>
                <Clock size={14} strokeWidth={1.75} color={colors.muted} />
              </View>

              <View className="mt-3 flex-row items-baseline gap-1.5">
                <Text font="mono" className="text-lg font-semibold">
                  8,420
                </Text>
                <Text variant="muted" className="text-sm">
                  of 12,000
                </Text>
              </View>

              <Progress value={70} className="mt-2.5" />

              <Text variant="muted" className="mt-2 text-xs">
                3,580 minutes remaining this month
              </Text>
            </Card>
          </Pressable>
        </Rise>
      ) : null}

      {/* Active Agents */}
      {isAuthenticated ? (
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

          <Card className="mx-5 mt-3 overflow-hidden">
            {ACTIVE_AGENTS.slice(0, 3).map((agent, index) => (
              <Rise key={agent.id} delay={rowDelay(2, index)}>
                <CallRow
                  avatar={<Mascot seed={agent.name} size={32} />}
                  title={agent.name}
                  subtitle={`${agent.status === "live" ? "Answering" : "Paused"} · ${agent.calls} calls`}
                  trailing={
                    <ChevronRight
                      size={14}
                      strokeWidth={1.75}
                      color={colors.muted}
                    />
                  }
                  showDivider={index < ACTIVE_AGENTS.length - 1}
                  onPress={() =>
                    router.push({
                      pathname: "/agent-detail",
                      params: { id: agent.id },
                    })
                  }
                />
              </Rise>
            ))}
          </Card>
        </View>
      ) : null}

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

      {/* Top cap of the card the rows sit in. Drawn here rather than wrapping
          the rows in a <Card>, because the rows are FlatList children now and
          can't share a single parent. */}
      {hasCalls ? (
        <View className="mx-5 mt-3 h-2 rounded-t-xl border-x border-t border-border bg-card" />
      ) : null}
    </>
  );
}

export default function HomeScreen() {
  const { isAuthenticated } = useAuth();
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

  // Rebuilt only when the address book changes, not per row — otherwise every
  // call would rescan every contact.
  const contactNames = useMemo(() => buildContactIndex(contacts), [contacts]);
  const rows = useMemo(
    () => calls.map((call) => toCallRowItem(call, contactNames)),
    [calls, contactNames],
  );

  const loadMore = useCallback(() => {
    // FlatList fires onEndReached more than once near the bottom; without the
    // in-flight guard that becomes duplicate pages.
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = useCallback(
    ({ item, index }: { item: CallRowItem; index: number }) => (
      <View className="mx-5 border-x border-border bg-card">
        {/* Capped so page 3's rows don't stagger in over two seconds. */}
        <Rise delay={rowDelay(3, Math.min(index, 5))}>
          <SwipeToCallRow onCall={() => callAgain(item)}>
            <CallListItem
              call={item}
              showDivider={index < rows.length - 1}
              onPress={() => openCallDetail(item)}
            />
          </SwipeToCallRow>
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
          <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />
        }
        ListHeaderComponent={
          <HomeHeader
            isAuthenticated={isAuthenticated}
            hasCalls={rows.length > 0}
          />
        }
        ListEmptyComponent={
          <View className="mx-5 mt-3 items-center rounded-xl border border-border bg-card px-5 py-8">
            {!isAuthenticated ? (
              <Text variant="muted" className="text-sm">
                Sign in to see your calls
              </Text>
            ) : isLoading ? (
              <Spinner size={20} />
            ) : isError ? (
              <Text variant="muted" className="text-center text-sm">
                {error instanceof Error
                  ? error.message
                  : "Couldn't load your calls"}
              </Text>
            ) : (
              <Text variant="muted" className="text-sm">
                No calls yet
              </Text>
            )}
          </View>
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
    </SafeAreaView>
  );
}
