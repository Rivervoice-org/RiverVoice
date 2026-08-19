import { View, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { ChevronLeft, Phone, Clock, Hash, Pencil } from "lucide-react-native";
import { Mascot } from "@/components/Mascot";
import { CallListItem } from "@/components/CallRow";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { AGENTS } from "@/screens/Agents/mock";
import { AGENT_CALLS } from "./mock";

function StatCard({
  icon: Icon,
  label,
  value,
  caption,
  className,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  caption: string;
  className?: string;
}) {
  return (
    <Card className={cn("p-3", className)}>
      <View className="h-7 w-7 items-center justify-center rounded-lg bg-secondary">
        <Icon size={13} strokeWidth={1.75} color="#3c3832" />
      </View>
      <Text variant="muted" className="mt-2.5 text-[11px] font-medium uppercase tracking-[0.12em]">
        {label}
      </Text>
      <Text font="mono" className="mt-0.5 text-lg font-semibold" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text variant="muted" className="mt-0.5 text-[11px]" numberOfLines={1}>
        {caption}
      </Text>
    </Card>
  );
}

function avgDuration(durations: string[]) {
  if (durations.length === 0) return "0:00";
  const totalSeconds = durations.reduce((sum, d) => {
    const [m, s] = d.split(":").map(Number);
    return sum + m * 60 + (s || 0);
  }, 0);
  const avg = Math.round(totalSeconds / durations.length);
  return `${Math.floor(avg / 60)}:${(avg % 60).toString().padStart(2, "0")}`;
}

export default function AgentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const agent = AGENTS.find((a) => a.id === id) ?? AGENTS[0];

  const recentCalls = AGENT_CALLS[agent.id] ?? [];

  const numberUsage = agent.numbers.map((number) => ({
    number,
    count: recentCalls.filter((call) => call.fromNumber === number).length,
  }));

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          className="h-9 w-9 items-center justify-center rounded-lg active:bg-secondary"
          hitSlop={8}
        >
          <ChevronLeft size={22} strokeWidth={1.75} color="#2e2a25" />
        </Pressable>
        <Text className="flex-1 text-center text-[17px] font-semibold">Agent</Text>
        <Pressable
          onPress={() =>
            router.push({ pathname: "/agent-new", params: { id: agent.id } })
          }
          className="h-9 w-9 items-center justify-center rounded-lg active:bg-secondary"
          hitSlop={8}
        >
          <Pencil size={18} strokeWidth={1.75} color="#2e2a25" />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero card */}
        <Card className="mx-5 items-center p-6">
          <View className="h-16 w-16 overflow-hidden rounded-full bg-secondary">
            <Mascot seed={agent.name} size={64} />
          </View>

          <Text className="mt-3 text-[20px] font-semibold">{agent.name}</Text>
          <Text variant="muted" className="mt-1 text-center text-sm">
            {agent.purpose}
          </Text>

          <Text variant="muted" className="mt-4 text-xs">
            Edited {agent.editedAt}
          </Text>
        </Card>

        {/* Stats */}
        <View className="mx-5 mt-4 flex-row flex-wrap gap-3">
          <StatCard
            className="w-[47.5%]"
            icon={Phone}
            label="Calls answered"
            value={String(agent.calls)}
            caption="All time"
          />
          <StatCard
            className="w-[47.5%]"
            icon={Clock}
            label="Avg. duration"
            value={avgDuration(recentCalls.map((c) => c.duration))}
            caption="Recent calls"
          />
        </View>

        {/* Numbers in use */}
        <View className="mt-8">
          <View className="px-5">
            <Text variant="muted" className="text-[11px] font-medium uppercase tracking-[0.14em]">
              Numbers in use
            </Text>
          </View>

          {numberUsage.length === 0 ? (
            <View className="mx-5 mt-3 items-center rounded-xl border border-dashed border-border py-6">
              <Hash size={18} strokeWidth={1.75} color="#b0ada7" />
              <Text variant="muted" className="mt-2 text-xs">
                No number assigned yet
              </Text>
            </View>
          ) : (
            <Card className="mx-5 mt-3 overflow-hidden">
              {numberUsage.map((entry, index) => (
                <View
                  key={entry.number}
                  className={cn(
                    "flex-row items-center gap-3 px-4 py-3",
                    index < numberUsage.length - 1 && "border-b border-border"
                  )}
                >
                  <View className="h-8 w-8 items-center justify-center rounded-lg bg-secondary">
                    <Phone size={14} strokeWidth={1.75} color="#3c3832" />
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text font="mono" className="text-sm font-medium">
                      {entry.number}
                    </Text>
                    <Text variant="muted" className="mt-0.5 text-[11px]">
                      {entry.count} {entry.count === 1 ? "call" : "calls"} answered on this number
                    </Text>
                  </View>
                </View>
              ))}
            </Card>
          )}
        </View>

        {/* Recent calls */}
        <View className="mt-8">
          <View className="flex-row items-center justify-between px-5">
            <Text variant="muted" className="text-[11px] font-medium uppercase tracking-[0.14em]">
              Recent calls
            </Text>
          </View>

          {recentCalls.length === 0 ? (
            <View className="mx-5 mt-3 items-center rounded-xl border border-dashed border-border py-8">
              <Phone size={18} strokeWidth={1.75} color="#b0ada7" />
              <Text variant="muted" className="mt-2 text-xs">
                No calls answered yet
              </Text>
            </View>
          ) : (
            <Card className="mx-5 mt-3 overflow-hidden">
              {recentCalls.map((call, index) => (
                <CallListItem
                  key={call.id}
                  call={call}
                  showDivider={index < recentCalls.length - 1}
                  onPress={() =>
                    router.push({
                      pathname: "/call-detail",
                      params: {
                        name: call.name,
                        number: call.number,
                        fromNumber: call.fromNumber,
                        agent: call.agent || "",
                        language: call.language,
                        duration: call.duration,
                        outcome: call.outcome,
                        time: call.time,
                      },
                    })
                  }
                />
              ))}
            </Card>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
