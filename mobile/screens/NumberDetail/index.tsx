import { View, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { ChevronLeft, Pencil, Phone, PhoneCall } from "lucide-react-native";
import { Mascot } from "@/components/Mascot";
import { CallListItem } from "@/components/CallRow";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { AGENTS } from "@/screens/Agents/mock";
import { NUMBERS } from "@/screens/Phonebook/mock";
import { NUMBER_CALLS } from "./mock";

function StatCard({
  icon: Icon,
  label,
  value,
  caption,
  className,
}: {
  icon: typeof Phone;
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

export default function NumberDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const number = NUMBERS.find((n) => n.id === id) ?? NUMBERS[0];

  if (!number) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas" edges={["top"]}>
        <Text variant="muted">Number not found</Text>
      </SafeAreaView>
    );
  }

  const live = number.status === "live";
  const recentCalls = NUMBER_CALLS[number.id] ?? [];
  const assignedAgent = number.assignedAgent
    ? AGENTS.find((a) => a.name === number.assignedAgent)
    : undefined;

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
        <Text className="flex-1 text-center text-[17px] font-semibold">Number</Text>
        <Pressable
          onPress={() =>
            router.push({ pathname: "/number-new", params: { id: number.id } })
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
          <View
            className={cn(
              "h-16 w-16 items-center justify-center rounded-full",
              live ? "bg-river-tint" : "bg-secondary"
            )}
          >
            <Phone size={26} strokeWidth={1.75} color={live ? "#3b5dab" : "#8f8c87"} />
          </View>

          <Text
            font="mono"
            className="mt-3 text-[22px] font-semibold tracking-[-0.02em]"
            adjustsFontSizeToFit
            numberOfLines={1}
          >
            {number.number}
          </Text>
          <Text variant="muted" className="mt-1 text-sm">
            {number.label}
          </Text>

          <View className="mt-4 flex-row items-center gap-1.5">
            <Badge variant="outline" className="px-2 py-0">
              <Text className="text-[11px] font-medium text-muted-foreground">
                {number.kind}
              </Text>
            </Badge>
            <Text variant="muted" className="text-xs">
              via {number.provider}
            </Text>
          </View>
        </Card>

        {/* Stats */}
        <View className="mx-5 mt-4">
          <StatCard
            icon={PhoneCall}
            label="Calls answered"
            value={String(number.calls)}
            caption="All time"
          />
        </View>

        {/* Assigned agent */}
        {number.assignedAgent && (
          <View className="mt-8">
            <View className="px-5">
              <Text variant="muted" className="text-[11px] font-medium uppercase tracking-[0.14em]">
                Agent
              </Text>
            </View>
            <Card className="mx-5 mt-3 overflow-hidden">
              <Pressable
                onPress={() =>
                  assignedAgent &&
                  router.push({ pathname: "/agent-detail", params: { id: assignedAgent.id } })
                }
                className="flex-row items-center gap-3 px-4 py-3 active:bg-secondary"
              >
                <Mascot seed={number.assignedAgent} size={32} />
                <View className="min-w-0 flex-1">
                  <Text className="text-sm font-medium">{number.assignedAgent}</Text>
                  <Text variant="muted" className="mt-0.5 text-[11px]">
                    Answers calls on this number
                  </Text>
                </View>
              </Pressable>
            </Card>
          </View>
        )}

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
