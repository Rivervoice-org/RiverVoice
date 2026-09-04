import { useMemo } from "react";
import { Pressable, SectionList, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft, Coins } from "lucide-react-native";
import { CallOutcome, CallOutcomeAvatar, CallRow } from "@/components/CallRow";
import { Mascot } from "@/components/Mascot";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Rise, rowDelay } from "@/components/ui/rise";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/lib/theme";
import { cn } from "@/lib/utils";

// Mocked: nothing on ferry persists a usage ledger yet (BillingObserver
// writes charges to credit_ledger, but there's no endpoint to page them from
// — see ferry/src/observer/billing_observer.rs). This shape mirrors
// credit_ledger's own columns: one row per charge, `callType` matching
// credit_ledger.call_type ("phone_call" | "try_agent") since a try-agent
// session bills credits too but was never a `calls` row — see
// BillingObserver's call_id/call_type handling.
const CREDITS = {
  remaining: 3580,
  total: 12000,
  used: 8420,
};

type CreditTransaction = {
  id: string;
  callType: "phone_call" | "try_agent";
  agentName: string | null;
  /** Only meaningful for `callType: "phone_call"` — a try-agent session has
   * no destination number. */
  toNumber: string | null;
  language: string;
  duration: string;
  credits: number;
  /** Only meaningful for `callType: "phone_call"` — a try-agent session has
   * no phone-call outcome to report. */
  outcome: CallOutcome | null;
  createdAt: string;
  time: string;
};

const MOCK_TRANSACTIONS: CreditTransaction[] = [
  {
    id: "1",
    callType: "phone_call",
    agentName: "Support Line",
    toNumber: "+91 98450 33120",
    language: "English → Hindi",
    duration: "4:12",
    credits: 210,
    outcome: CallOutcome.Resolved,
    createdAt: new Date().toISOString(),
    time: "10:42 AM",
  },
  {
    id: "2",
    callType: "try_agent",
    agentName: "Sales Bot",
    toNumber: null,
    language: "English → Tamil",
    duration: "1:05",
    credits: 55,
    outcome: null,
    createdAt: new Date().toISOString(),
    time: "9:15 AM",
  },
  {
    id: "3",
    callType: "phone_call",
    agentName: null,
    toNumber: "+91 99001 44556",
    language: "English → Telugu",
    duration: "0:00",
    credits: 0,
    outcome: CallOutcome.Missed,
    createdAt: new Date(Date.now() - 86_400_000).toISOString(),
    time: "6:50 PM",
  },
  {
    id: "4",
    callType: "phone_call",
    agentName: "Support Line",
    toNumber: "+91 98450 33120",
    language: "English → Hindi",
    duration: "7:48",
    credits: 390,
    outcome: CallOutcome.Resolved,
    createdAt: new Date(Date.now() - 86_400_000).toISOString(),
    time: "2:05 PM",
  },
  {
    id: "5",
    callType: "try_agent",
    agentName: "Onboarding Guide",
    toNumber: null,
    language: "English → Kannada",
    duration: "0:48",
    credits: 20,
    outcome: null,
    createdAt: new Date(Date.now() - 86_400_000).toISOString(),
    time: "11:58 AM",
  },
  {
    id: "6",
    callType: "phone_call",
    agentName: "Onboarding Guide",
    toNumber: "+91 98123 66789",
    language: "English → Kannada",
    duration: "3:30",
    credits: 175,
    outcome: CallOutcome.Resolved,
    createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    time: "11:20 AM",
  },
];

function dateLabel(iso: string, now: number = Date.now()): string {
  const date = new Date(iso);
  const days = Math.floor(
    (new Date(now).setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) /
      86_400_000,
  );
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}

function groupByDate(transactions: CreditTransaction[]) {
  const order: string[] = [];
  const byLabel = new Map<string, CreditTransaction[]>();
  for (const tx of transactions) {
    const label = dateLabel(tx.createdAt);
    if (!byLabel.has(label)) {
      byLabel.set(label, []);
      order.push(label);
    }
    byLabel.get(label)!.push(tx);
  }
  return order.map((label) => ({ title: label, data: byLabel.get(label)! }));
}

function TransactionRow({
  tx,
  index,
  showDivider,
}: {
  tx: CreditTransaction;
  index: number;
  showDivider: boolean;
}) {
  const noCharge = tx.credits === 0;
  const isTryAgent = tx.callType === "try_agent";

  return (
    <Rise delay={rowDelay(1, index)}>
      <CallRow
        avatar={
          isTryAgent ? (
            <Mascot seed={tx.agentName ?? "agent"} size={32} />
          ) : (
            <CallOutcomeAvatar outcome={tx.outcome ?? CallOutcome.Resolved} />
          )
        }
        title={
          isTryAgent
            ? `Try agent · ${tx.agentName ?? "Agent"}`
            : (tx.agentName ?? "Direct call")
        }
        subtitle={`${tx.language} · ${tx.duration}`}
        trailing={
          <View className="items-end">
            <Text
              font="mono"
              className="text-sm font-semibold tabular-nums"
              variant={noCharge ? "muted" : "destructive"}
            >
              {noCharge ? "—" : `-${tx.credits.toLocaleString()}`}
            </Text>
            <Text variant="muted" className="mt-0.5 text-[11px]">
              {tx.time}
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
  const sections = useMemo(() => groupByDate(MOCK_TRANSACTIONS), []);

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
                <Text font="mono" className="text-lg font-semibold">
                  {CREDITS.remaining.toLocaleString()}
                </Text>
                <Text variant="muted" className="text-sm">
                  of {CREDITS.total.toLocaleString()}
                </Text>
              </View>

              <Progress
                value={(CREDITS.remaining / CREDITS.total) * 100}
                className="mt-2.5"
              />

              <Text variant="muted" className="mt-2 text-xs">
                {CREDITS.used.toLocaleString()} credits used this month
              </Text>
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
              tx={item}
              index={index}
              showDivider={index < section.data.length - 1}
            />
          </View>
        )}
      />
    </SafeAreaView>
  );
}
