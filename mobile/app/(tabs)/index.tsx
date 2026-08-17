import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  Phone,
  PhoneOutgoing,
  PhoneIncoming,
  PhoneMissed,
  ChevronRight,
  Clock,
} from "lucide-react-native";
import { Mascot } from "../../components/mascot";

const RECENT_CALLS = [
  {
    id: "1",
    number: "+91 98765 43210",
    agent: "Front Desk",
    language: "Hindi → English",
    duration: "3:42",
    outcome: "resolved",
    time: "2m ago",
  },
  {
    id: "2",
    number: "+91 87654 32109",
    agent: "Billing",
    language: "Tamil → English",
    duration: "1:15",
    outcome: "transferred",
    time: "18m ago",
  },
  {
    id: "3",
    number: "+91 76543 21098",
    agent: "Front Desk",
    language: "Bengali → English",
    duration: "5:08",
    outcome: "resolved",
    time: "1h ago",
  },
  {
    id: "4",
    number: "+91 65432 10987",
    agent: null,
    language: "Hindi → English",
    duration: "0:32",
    outcome: "missed",
    time: "3h ago",
  },
  {
    id: "5",
    number: "+91 54321 09876",
    agent: "Order Status",
    language: "Gujarati → English",
    duration: "2:11",
    outcome: "resolved",
    time: "Yesterday",
  },
];

const ACTIVE_AGENTS = [
  { id: "1", name: "Front Desk", status: "live", calls: 847 },
  { id: "2", name: "Billing", status: "live", calls: 312 },
  { id: "3", name: "Order Status", status: "paused", calls: 156 },
];

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

function CallOutcomeIcon({ outcome }: { outcome: string }) {
  switch (outcome) {
    case "resolved":
      return <PhoneIncoming size={14} strokeWidth={1.75} color="#2a8c4d" />;
    case "transferred":
      return <PhoneOutgoing size={14} strokeWidth={1.75} color="#3b5dab" />;
    case "missed":
      return <PhoneMissed size={14} strokeWidth={1.75} color="#c43030" />;
    default:
      return <Phone size={14} strokeWidth={1.75} color="#8f8c87" />;
  }
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
          <Text className="text-[28px] font-semibold leading-tight tracking-[-0.02em] text-foreground">
            {getGreeting()}, Pavan
          </Text>
          <Text className="mt-1.5 text-sm text-muted-foreground">
            {getFormattedDate()}
          </Text>
        </View>

        {/* Minutes Used */}
        <View className="mx-5 mt-4 rounded-xl border border-border bg-card p-4 shadow-float">
          <View className="flex-row items-center justify-between">
            <Text className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Minutes used
            </Text>
            <Clock size={14} strokeWidth={1.75} color="#8f8c87" />
          </View>

          <View className="mt-3 flex-row items-baseline gap-1.5">
            <Text className="font-mono text-lg font-semibold text-foreground">
              8,420
            </Text>
            <Text className="text-sm text-muted-foreground">
              of 12,000
            </Text>
          </View>

          <View className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-border">
            <View className="h-full w-[70%] rounded-full bg-foreground" />
          </View>

          <Text className="mt-2 text-xs text-muted-foreground">
            3,580 minutes remaining this month
          </Text>
        </View>

        {/* Active Agents */}
        <View className="mt-8">
          <View className="flex-row items-center justify-between px-5">
            <Text className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Agents
            </Text>
            <Pressable className="flex-row items-center gap-1">
              <Text className="text-xs font-medium text-foreground">All</Text>
              <ChevronRight size={14} strokeWidth={1.75} color="#3c3832" />
            </Pressable>
          </View>

          <View className="mt-3 mx-5 rounded-xl border border-border bg-card shadow-float overflow-hidden">
            {ACTIVE_AGENTS.map((agent, index) => (
              <Pressable
                key={agent.id}
                onPress={() => {}}
                className={`flex-row items-center gap-3 px-4 py-3 ${
                  index < ACTIVE_AGENTS.length - 1 ? "border-b border-border" : ""
                }`}

              >
                <Mascot seed={agent.name} size={32} />
                <View className="flex-1">
                  <View className="flex-row items-center gap-1.5">
                    <Text className="text-sm font-medium text-foreground">
                      {agent.name}
                    </Text>
                    <AgentStatusDot status={agent.status} />
                  </View>
                  <Text className="text-[11px] text-muted-foreground">
                    {agent.status === "live" ? "Answering" : "Paused"} · {agent.calls} calls
                  </Text>
                </View>
                <ChevronRight size={14} strokeWidth={1.75} color="#8f8c87" />
              </Pressable>
            ))}
          </View>
        </View>

        {/* Recent Calls */}
        <View className="mt-8">
          <View className="flex-row items-center justify-between px-5">
            <Text className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Recent calls
            </Text>
            <Pressable className="flex-row items-center gap-1">
              <Text className="text-xs font-medium text-foreground">Call log</Text>
              <ChevronRight size={14} strokeWidth={1.75} color="#3c3832" />
            </Pressable>
          </View>

          <View className="mt-3 mx-5 rounded-xl border border-border bg-card shadow-float overflow-hidden">
            {RECENT_CALLS.map((call, index) => (
              <Pressable
                key={call.id}
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
                className={`flex-row items-center gap-3 px-4 py-3 ${
                  index < RECENT_CALLS.length - 1 ? "border-b border-border" : ""
                }`}

              >
                {call.agent ? (
                  <Mascot seed={call.agent} size={32} />
                ) : (
                  <View className="h-8 w-8 items-center justify-center rounded-lg bg-secondary">
                    <CallOutcomeIcon outcome={call.outcome} />
                  </View>
                )}
                <View className="flex-1 min-w-0">
                  <View className="flex-row items-center gap-1.5">
                    <Text className="font-mono text-sm text-foreground">
                      {call.number}
                    </Text>
                  </View>
                  <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
                    {call.agent ? `${call.agent} · ` : ""}{call.language}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="font-mono text-[11px] tabular-nums text-muted-foreground">
                    {call.duration}
                  </Text>
                  <Text className="text-[11px] text-muted-foreground">
                    {call.time}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
