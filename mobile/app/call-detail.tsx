import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import {
  ChevronLeft,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Phone,
  Clock,
  Globe,
  User,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react-native";
import { Mascot } from "../components/mascot";

const OUTCOME_CONFIG = {
  resolved: {
    label: "Resolved",
    color: "#2a8c4d",
    bg: "#2a8c4d14",
    icon: PhoneIncoming,
  },
  transferred: {
    label: "Transferred",
    color: "#3b5dab",
    bg: "#3b5dab14",
    icon: PhoneOutgoing,
  },
  missed: {
    label: "Missed",
    color: "#c4384c",
    bg: "#c4384c14",
    icon: PhoneMissed,
  },
};

export default function CallDetailScreen() {
  const params = useLocalSearchParams<{
    number: string;
    agent: string;
    language: string;
    duration: string;
    outcome: string;
    time: string;
  }>();

  const outcome = OUTCOME_CONFIG[params.outcome as keyof typeof OUTCOME_CONFIG] || OUTCOME_CONFIG.resolved;
  const OutcomeIcon = outcome.icon;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          className="h-9 w-9 items-center justify-center rounded-lg"
        >
          <ChevronLeft size={22} strokeWidth={1.75} color="#2e2a25" />
        </Pressable>
        <Text className="flex-1 text-center text-[17px] font-semibold text-foreground">
          Call details
        </Text>
        <View className="w-9" />
      </View>

      {/* Contact card */}
      <View className="mx-5 mt-4 items-center rounded-2xl border border-border bg-card p-6 shadow-float">
        {params.agent ? (
          <Mascot seed={params.agent} size={64} />
        ) : (
          <View className="h-16 w-16 items-center justify-center rounded-full bg-secondary">
            <Phone size={24} strokeWidth={1.75} color="#8f8c87" />
          </View>
        )}
        <Text className="mt-4 text-[20px] font-semibold text-foreground">
          {params.agent || "Direct call"}
        </Text>
        <Text className="mt-1 font-mono text-sm text-muted-foreground">
          {params.number}
        </Text>

        {/* Outcome badge */}
        <View
          className="mt-4 flex-row items-center gap-1.5 rounded-full px-3 py-1"
          style={{ backgroundColor: outcome.bg }}
        >
          <OutcomeIcon size={13} strokeWidth={1.75} color={outcome.color} />
          <Text style={{ color: outcome.color }} className="text-xs font-medium">
            {outcome.label}
          </Text>
        </View>
      </View>

      {/* Details */}
      <View className="mx-5 mt-4 rounded-xl border border-border bg-card shadow-float overflow-hidden">
        {/* Duration */}
        <View className="flex-row items-center gap-3 border-b border-border px-4 py-3.5">
          <View className="h-8 w-8 items-center justify-center rounded-lg bg-secondary">
            <Clock size={15} strokeWidth={1.75} color="#3c3832" />
          </View>
          <View className="flex-1">
            <Text className="text-[13px] text-muted-foreground">Duration</Text>
            <Text className="text-sm font-medium text-foreground">{params.duration}</Text>
          </View>
        </View>

        {/* Language */}
        <View className="flex-row items-center gap-3 border-b border-border px-4 py-3.5">
          <View className="h-8 w-8 items-center justify-center rounded-lg bg-secondary">
            <Globe size={15} strokeWidth={1.75} color="#3c3832" />
          </View>
          <View className="flex-1">
            <Text className="text-[13px] text-muted-foreground">Language</Text>
            <Text className="text-sm font-medium text-foreground">{params.language}</Text>
          </View>
        </View>

        {/* Agent */}
        {params.agent && (
          <View className="flex-row items-center gap-3 border-b border-border px-4 py-3.5">
            <View className="h-8 w-8 items-center justify-center rounded-lg bg-secondary">
              <User size={15} strokeWidth={1.75} color="#3c3832" />
            </View>
            <View className="flex-1">
              <Text className="text-[13px] text-muted-foreground">Agent</Text>
              <Text className="text-sm font-medium text-foreground">{params.agent}</Text>
            </View>
          </View>
        )}

        {/* Time */}
        <View className="flex-row items-center gap-3 px-4 py-3.5">
          <View className="h-8 w-8 items-center justify-center rounded-lg bg-secondary">
            <ArrowUpRight size={15} strokeWidth={1.75} color="#3c3832" />
          </View>
          <View className="flex-1">
            <Text className="text-[13px] text-muted-foreground">Time</Text>
            <Text className="text-sm font-medium text-foreground">{params.time}</Text>
          </View>
        </View>
      </View>

      {/* Actions */}
      <View className="mx-5 mt-6 flex-row gap-3">
        <Pressable className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-foreground py-3.5">
          <Phone size={16} strokeWidth={1.75} color="#fcfbf9" />
          <Text className="text-sm font-medium text-primary-foreground">Call back</Text>
        </Pressable>
        <Pressable className="flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-border bg-card py-3.5 shadow-float">
          <Mascot seed="retry-agent" size={16} />
          <Text className="text-sm font-medium text-foreground">New call</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
