import { useState } from "react";
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
  Play,
  Pause,
  Download,
  CalendarDays,
  AudioLines,
  MessageSquareText,
  ChevronRight,
} from "lucide-react-native";
import { Mascot } from "@/components/Mascot";
import { CallListItem } from "@/components/CallRow";
import { InitialsAvatar } from "@/components/InitialsAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Rise, rowDelay } from "@/components/ui/rise";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { useThemeColors, type ThemeColors } from "@/lib/theme";
import { TRANSCRIPT } from "@/screens/Transcript/mock";
import { CALL_HISTORY, WAVEFORM } from "./mock";

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

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

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
  const params = useLocalSearchParams<{
    name: string;
    number: string;
    fromNumber: string;
    agent: string;
    language: string;
    duration: string;
    outcome: string;
    time: string;
  }>();

  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const outcome = OUTCOME_CONFIG[params.outcome as keyof typeof OUTCOME_CONFIG] ?? OUTCOME_CONFIG.resolved;
  const OutcomeIcon = outcome.icon;
  const outcomeColor = colors[outcome.colorKey];

  const [minutes, seconds] = params.duration.split(":").map(Number);
  const totalSeconds = (minutes || 0) * 60 + (seconds || 0);
  const usedMinutes = Math.max(1, Math.ceil(totalSeconds / 60));

  function togglePlay() {
    setPlaying((p) => !p);
    setProgress(0);
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      {/* Header */}
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
              {params.name || params.agent || "Direct call"}
            </Text>
            <Text font="mono" variant="muted" className="mt-1 text-sm">
              {params.number}
            </Text>

            {params.agent ? (
              <View className="mt-2.5 flex-row items-center gap-1.5">
                <Mascot seed={params.agent} size={16} />
                <Text variant="muted" className="text-xs">
                  Handled by{" "}
                  <Text className="text-xs font-medium text-foreground">
                    {params.agent}
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
                <Text variant="muted" className="text-xs">{params.time}</Text>
              </View>
              <View className="h-3 w-px bg-border" />
              <View className="flex-row items-center gap-1.5">
                <Clock size={12} strokeWidth={1.75} color={colors.muted} />
                <Text font="mono" variant="muted" className="text-xs">{params.duration}</Text>
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
              value={params.duration}
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
              value={(params.language.split("→")[0] ?? params.language).trim()}
              caption={params.language}
            />
            <StatCard
              className="w-[47.5%]"
              icon={Phone}
              label="Called from"
              value={params.fromNumber}
              caption="Your number"
            />
          </View>
        </Rise>

        {/* Recording */}
        <Rise index={2}>
          <Card className="mx-5 mt-6 p-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <AudioLines size={15} strokeWidth={1.75} color={colors.ink} />
                <Text className="text-[13px] font-semibold">Recording</Text>
              </View>
              <Text font="mono" variant="muted" className="text-xs">{params.duration}</Text>
            </View>

            <View className="mt-4 flex-row items-center gap-4">
              <Pressable
                onPress={togglePlay}
                className="h-11 w-11 items-center justify-center rounded-full bg-foreground active:opacity-80"
                hitSlop={8}
              >
                {playing ? (
                  <Pause size={16} strokeWidth={2} color={colors.onInk} fill={colors.onInk} />
                ) : (
                  <Play size={16} strokeWidth={2} color={colors.onInk} fill={colors.onInk} style={{ marginLeft: 2 }} />
                )}
              </Pressable>

              <View className="flex-1">
                <View className="h-10 flex-row items-center justify-between gap-[2px]">
                  {WAVEFORM.map((height, index) => {
                    const reached = index / WAVEFORM.length <= progress / 100;
                    return (
                      <View
                        key={index}
                        className={`flex-1 rounded-full ${reached ? "bg-foreground" : "bg-border"}`}
                        style={{ height: height * 0.7 }}
                      />
                    );
                  })}
                </View>
                <View className="mt-1.5 flex-row items-center justify-between">
                  <Text font="mono" variant="muted" className="text-[11px]">
                    {formatTime(Math.floor((progress / 100) * totalSeconds))}
                  </Text>
                  <Text font="mono" variant="muted" className="text-[11px]">{params.duration}</Text>
                </View>
              </View>
            </View>

            <View className="mt-4 flex-row gap-2.5">
              <Button variant="outline" className="flex-1 py-2.5">
                <Download size={13} strokeWidth={1.75} color={colors.ink} />
                <Text className="text-xs font-medium">Download</Text>
              </Button>
              <Button variant="outline" className="flex-1 py-2.5">
                <Phone size={13} strokeWidth={1.75} color={colors.ink} />
                <Text className="text-xs font-medium">Share</Text>
              </Button>
            </View>
          </Card>
        </Rise>

        {/* Transcription */}
        <Rise index={3}>
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/transcript",
                params: {
                  name: params.name,
                  number: params.number,
                  agent: params.agent,
                },
              })
            }
            className="mx-5 mt-6 flex-row items-center justify-between rounded-xl border border-border bg-card px-4 py-3.5 shadow-float active:bg-secondary"
          >
            <View className="flex-row items-center gap-2">
              <MessageSquareText size={15} strokeWidth={1.75} color={colors.ink} />
              <Text className="text-[13px] font-semibold">View transcription</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Text variant="muted" className="text-[11px] font-medium">
                {TRANSCRIPT.length} lines
              </Text>
              <ChevronRight size={16} strokeWidth={1.75} color={colors.muted} />
            </View>
          </Pressable>
        </Rise>

        {/* History */}
        <View className="mt-8">
          <Rise index={4}>
            <View className="flex-row items-center justify-between px-5">
              <Text variant="muted" className="text-[11px] font-medium uppercase tracking-[0.14em]">
                History
              </Text>
              <Pressable className="flex-row items-center gap-1">
                <Text className="text-xs font-medium">See all</Text>
                <ChevronRight size={14} strokeWidth={1.75} color={colors.ink} />
              </Pressable>
            </View>
          </Rise>

          <Card className="mx-5 mt-3 overflow-hidden">
            {CALL_HISTORY.map((call, index) => (
              <Rise key={call.id} delay={rowDelay(4, index)}>
                <CallListItem
                  call={call}
                  showDivider={index < CALL_HISTORY.length - 1}
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

        {/* Actions */}
        <Rise index={5}>
          <View className="mx-5 mt-8">
            <Button size="lg">
              <Phone size={16} strokeWidth={2} color={colors.onInk} />
              <Text className="text-sm font-medium text-primary-foreground">Call</Text>
            </Button>
          </View>
        </Rise>
      </ScrollView>
    </SafeAreaView>
  );
}
