import { View, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronRight, Clock } from "lucide-react-native";
import { Mascot } from "@/components/Mascot";
import { CallListItem, CallRow } from "@/components/CallRow";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Rise, rowDelay } from "@/components/ui/rise";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/lib/theme";
import { useAuth } from "@/hooks/use-auth";
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

export default function HomeScreen() {
  const colors = useThemeColors();
  const { isAuthenticated } = useAuth();
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting */}
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
            <Card className="mx-5 mt-4 p-4">
              <View className="flex-row items-center justify-between">
                <Text variant="muted" className="text-[11px] font-medium uppercase tracking-[0.14em]">
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
          </Rise>
        ) : null}

        {/* Active Agents */}
        {isAuthenticated ? (
          <View className="mt-8">
            <Rise index={2}>
              <View className="px-5">
                <Text variant="muted" className="text-[11px] font-medium uppercase tracking-[0.14em]">
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
                      <ChevronRight size={14} strokeWidth={1.75} color={colors.muted} />
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
              <Text variant="muted" className="text-[11px] font-medium uppercase tracking-[0.14em]">
                Recent calls
              </Text>
            </View>
          </Rise>

          <Card className="mx-5 mt-3 overflow-hidden">
            {RECENT_CALLS.map((call, index) => (
              <Rise key={call.id} delay={rowDelay(3, index)}>
                <CallListItem
                  call={call}
                  showDivider={index < RECENT_CALLS.length - 1}
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
              </Rise>
            ))}
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
