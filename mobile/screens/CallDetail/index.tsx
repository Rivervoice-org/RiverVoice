import { View, Pressable, ScrollView } from "react-native";
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
  CalendarDays,
  AudioLines,
  MessageSquareText,
  ChevronRight,
  CloudOff,
  RotateCw,
} from "lucide-react-native";
import { Mascot } from "@/components/Mascot";
import { InitialsAvatar } from "@/components/InitialsAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Rise } from "@/components/ui/rise";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { useThemeColors, type ThemeColors } from "@/lib/theme";
import { formatDuration } from "@/lib/call-status";
import { useCallDetail } from "@/lib/calls/hooks";
import { CallDetailSkeleton } from "./skeleton";
import { languageLabel, outcomeOf, relativeTime } from "@/lib/calls/format";

const OUTCOME_CONFIG = {
  resolved: {
    label: "Resolved",
    icon: PhoneIncoming,
    colorKey: "green" as keyof ThemeColors,
    bgClassName: "bg-green-tint",
  },
  transferred: {
    label: "Transferred",
    icon: PhoneOutgoing,
    colorKey: "river" as keyof ThemeColors,
    bgClassName: "bg-river-tint",
  },
  missed: {
    label: "Missed",
    icon: PhoneMissed,
    colorKey: "destructive" as keyof ThemeColors,
    bgClassName: "bg-destructive/10",
  },
} as const;

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
  const colors = useThemeColors();
  return (
    <Card className={cn("p-3", className)}>
      <View className="h-7 w-7 items-center justify-center rounded-lg bg-secondary">
        <Icon size={13} strokeWidth={1.75} color={colors.ink} />
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

export default function CallDetailScreen() {
  const colors = useThemeColors();
  // `id` addresses the call; `name` is the address-book match the server has
  // never seen, so it can only come from the screen that had it.
  const params = useLocalSearchParams<{ id: string; name?: string }>();
  const { data: call, isLoading, isError, error, refetch } = useCallDetail(params.id);

  const header = (
    <View className="flex-row items-center px-4 py-3">
      <Pressable
        onPress={() => router.back()}
        className="h-9 w-9 items-center justify-center rounded-lg active:bg-secondary"
        hitSlop={8}
      >
        <ChevronLeft size={22} strokeWidth={1.75} color={colors.ink} />
      </Pressable>
      <Text className="flex-1 text-center text-[17px] font-semibold">
        Call details
      </Text>
      <View className="w-9" />
    </View>
  );

  if (isLoading || isError || !call) {
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
        {header}
        {isLoading ? (
          <CallDetailSkeleton />
        ) : (
          <View className="flex-1 items-center justify-center px-10">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <CloudOff size={22} strokeWidth={1.75} color={colors.destructive} />
            </View>
            <Text className="mt-3 text-center text-sm font-medium">
              Couldn&apos;t load this call
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
          </View>
        )}
      </SafeAreaView>
    );
  }

  const outcome = OUTCOME_CONFIG[outcomeOf(call.endReason)] ?? OUTCOME_CONFIG.resolved;
  const OutcomeIcon = outcome.icon;
  const outcomeColor = colors[outcome.colorKey];
  const duration = formatDuration(call.billableSeconds);
  const language = languageLabel(call.inputLanguage, call.outputLanguage);
  // Billing rounds up, and a connected call is never billed as zero minutes.
  const usedMinutes = Math.max(1, Math.ceil(call.billableSeconds / 60));

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      {header}

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero card */}
        <Rise index={0}>
          <Card className="mx-5 items-center p-6">
            {params.name ? (
              <InitialsAvatar name={params.name} size={64} />
            ) : (
              <View className="h-16 w-16 items-center justify-center rounded-full bg-secondary">
                <Phone size={24} strokeWidth={1.75} color={colors.muted} />
              </View>
            )}

            <Text className="mt-3 text-[20px] font-semibold">
              {params.name || call.toNumber}
            </Text>
            <Text font="mono" variant="muted" className="mt-1 text-sm">
              {call.toNumber}
            </Text>

            {call.agentName ? (
              <View className="mt-2.5 flex-row items-center gap-1.5">
                <Mascot seed={call.agentName} size={16} />
                <Text variant="muted" className="text-xs">
                  Handled by{" "}
                  <Text className="text-xs font-medium text-foreground">
                    {call.agentName}
                  </Text>
                </Text>
              </View>
            ) : (
              <Text variant="muted" className="mt-2.5 text-xs">
                Direct call
              </Text>
            )}

            <Badge className={cn("mt-4 px-3 py-1", outcome.bgClassName)}>
              <OutcomeIcon size={13} strokeWidth={1.75} color={outcomeColor} />
              <Text style={{ color: outcomeColor }} className="text-xs font-medium">
                {outcome.label}
              </Text>
            </Badge>

            <View className="mt-4 flex-row items-center gap-4">
              <View className="flex-row items-center gap-1.5">
                <CalendarDays size={12} strokeWidth={1.75} color={colors.muted} />
                <Text variant="muted" className="text-xs">
                  {relativeTime(call.createdAt)}
                </Text>
              </View>
              <View className="h-3 w-px bg-border" />
              <View className="flex-row items-center gap-1.5">
                <Clock size={12} strokeWidth={1.75} color={colors.muted} />
                <Text font="mono" variant="muted" className="text-xs">
                  {duration}
                </Text>
              </View>
            </View>
          </Card>
        </Rise>

        {/* Stats */}
        <Rise index={1}>
          <View className="mx-5 mt-4 flex-row flex-wrap gap-3">
            <StatCard
              className="w-[47.5%]"
              icon={Clock}
              label="Duration"
              value={duration}
              caption="Total call time"
            />
            <StatCard
              className="w-[47.5%]"
              icon={AudioLines}
              label="Minutes"
              value={String(usedMinutes)}
              caption="Billed minutes"
            />
            <StatCard
              className="w-[47.5%]"
              icon={Globe}
              label="Language"
              value={(language.split("→")[0] ?? language).trim() || "—"}
              caption={language || "Not recorded"}
            />
            <StatCard
              className="w-[47.5%]"
              icon={Phone}
              label="Called from"
              value={call.fromNumber}
              caption="Your number"
            />
          </View>
        </Rise>

        {/* Recording. Nothing captures audio yet, so this states that plainly
            rather than showing a player that can't play anything. */}
        <Rise index={2}>
          <Card className="mx-5 mt-6 p-4">
            <View className="flex-row items-center gap-2">
              <AudioLines size={15} strokeWidth={1.75} color={colors.ink} />
              <Text className="text-[13px] font-semibold">Recording</Text>
            </View>
            <Text variant="muted" className="mt-2 text-xs">
              {call.recordingUrl
                ? "Recording available"
                : "No recording for this call"}
            </Text>
          </Card>
        </Rise>

        {/* Transcription */}
        <Rise index={3}>
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/transcript",
                params: { id: call.id, name: params.name ?? "" },
              })
            }
            disabled={call.utterances.length === 0}
            className={cn(
              "mx-5 mt-6 flex-row items-center justify-between rounded-xl border border-border bg-card px-4 py-3.5 shadow-float",
              call.utterances.length > 0 ? "active:bg-secondary" : "opacity-60",
            )}
          >
            <View className="flex-row items-center gap-2">
              <MessageSquareText size={15} strokeWidth={1.75} color={colors.ink} />
              <Text className="text-[13px] font-semibold">View transcription</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Text variant="muted" className="text-[11px] font-medium">
                {call.utterances.length
                  ? `${call.utterances.length} lines`
                  : "No transcript"}
              </Text>
              <ChevronRight size={16} strokeWidth={1.75} color={colors.muted} />
            </View>
          </Pressable>
        </Rise>

        {/* Actions */}
        <Rise index={4}>
          <View className="mx-5 mt-8">
            <Button
              size="lg"
              onPress={() =>
                router.push({
                  pathname: "/in-call",
                  params: {
                    name: params.name ?? "",
                    phone: call.toNumber,
                    agentId: call.agentId ?? "",
                    agentName: call.agentName ?? "Agent",
                  },
                })
              }
            >
              <Phone size={16} strokeWidth={2} color={colors.onInk} />
              <Text className="text-sm font-medium text-primary-foreground">Call</Text>
            </Button>
          </View>
        </Rise>
      </ScrollView>
    </SafeAreaView>
  );
}
