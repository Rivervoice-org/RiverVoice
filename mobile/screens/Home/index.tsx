import { View, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronRight, Clock } from "lucide-react-native";
import { Mascot } from "@/components/Mascot";
import { CallOutcomeAvatar, CallRow } from "@/components/CallRow";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Text } from "@/components/ui/text";
import { ACTIVE_AGENTS, RECENT_CALLS } from "./mock";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getFormattedDate(): string {
  const now = new Date();
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]}`;
}

function AgentStatusDot({ status }: { status: string }) {
  return (
    <View
      className={`h-[5px] w-[5px] rounded-full ${
        status === "live" ? "bg-river" : "bg-border"
      }`}
    />
  );
}

export default function HomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting */}
        <View className="px-5 pt-4 pb-2">
          <Text className="text-[28px] font-semibold leading-tight tracking-[-0.02em]">
            {getGreeting()}, Pavan
          </Text>
          <Text variant="muted" className="mt-1.5 text-sm">
            {getFormattedDate()}
          </Text>
        </View>

        {/* Minutes Used */}
        <Card className="mx-5 mt-4 p-4">
          <View className="flex-row items-center justify-between">
            <Text variant="muted" className="text-[11px] font-medium uppercase tracking-[0.14em]">
              Minutes used
            </Text>
            <Clock size={14} strokeWidth={1.75} color="#8f8c87" />
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

        {/* Active Agents */}
        <View className="mt-8">
          <View className="flex-row items-center justify-between px-5">
            <Text variant="muted" className="text-[11px] font-medium uppercase tracking-[0.14em]">
              Agents
            </Text>
            <Pressable className="flex-row items-center gap-1">
              <Text className="text-xs font-medium">All</Text>
              <ChevronRight size={14} strokeWidth={1.75} color="#3c3832" />
            </Pressable>
          </View>

          <Card className="mx-5 mt-3 overflow-hidden">
            {ACTIVE_AGENTS.map((agent, index) => (
              <CallRow
                key={agent.id}
                avatar={<Mascot seed={agent.name} size={32} />}
                title={agent.name}
                titleRight={<AgentStatusDot status={agent.status} />}
                subtitle={`${agent.status === "live" ? "Answering" : "Paused"} · ${agent.calls} calls`}
                trailing={
                  <ChevronRight size={14} strokeWidth={1.75} color="#8f8c87" />
                }
                showDivider={index < ACTIVE_AGENTS.length - 1}
                onPress={() => {}}
              />
            ))}
          </Card>
        </View>

        {/* Recent Calls */}
        <View className="mt-8">
          <View className="flex-row items-center justify-between px-5">
            <Text variant="muted" className="text-[11px] font-medium uppercase tracking-[0.14em]">
              Recent calls
            </Text>
            <Pressable className="flex-row items-center gap-1">
              <Text className="text-xs font-medium">Call log</Text>
              <ChevronRight size={14} strokeWidth={1.75} color="#3c3832" />
            </Pressable>
          </View>

          <Card className="mx-5 mt-3 overflow-hidden">
            {RECENT_CALLS.map((call, index) => (
              <CallRow
                key={call.id}
                avatar={
                  call.agent ? (
                    <Mascot seed={call.agent} size={32} />
                  ) : (
                    <CallOutcomeAvatar outcome={call.outcome} />
                  )
                }
                title={call.number}
                mono
                subtitle={`${call.agent ? `${call.agent} · ` : ""}${call.language}`}
                trailing={
                  <View className="items-end">
                    <Text font="mono" variant="muted" className="text-[11px] tabular-nums">
                      {call.duration}
                    </Text>
                    <Text variant="muted" className="text-[11px]">
                      {call.time}
                    </Text>
                  </View>
                }
                showDivider={index < RECENT_CALLS.length - 1}
                onPress={() =>
                  router.push({
                    pathname: "/call-detail",
                    params: {
                      number: call.number,
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
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
