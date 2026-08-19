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
  User,
  Mic,
  MessageSquareText,
  ChevronDown,
} from "lucide-react-native";
import { Mascot } from "@/components/Mascot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { TRANSCRIPT, WAVEFORM, type TranscriptEntry } from "./mock";

const OUTCOME_CONFIG = {
  resolved: {
    label: "Resolved",
    color: "#2a8c4d",
    bg: "#eaf8ef",
    icon: PhoneIncoming,
  },
  transferred: {
    label: "Transferred",
    color: "#3b5dab",
    bg: "#eef2fc",
    icon: PhoneOutgoing,
  },
  missed: {
    label: "Missed",
    color: "#c4384c",
    bg: "#fdf0f0",
    icon: PhoneMissed,
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
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  caption: string;
}) {
  return (
    <Card className="flex-1 p-3">
      <View className="h-7 w-7 items-center justify-center rounded-lg bg-secondary">
        <Icon size={13} strokeWidth={1.75} color="#3c3832" />
      </View>
      <Text variant="muted" className="mt-2.5 text-[11px] font-medium uppercase tracking-[0.12em]">
        {label}
      </Text>
      <Text font="mono" className="mt-0.5 text-lg font-semibold">
        {value}
      </Text>
      <Text variant="muted" className="mt-0.5 text-[11px]" numberOfLines={1}>
        {caption}
      </Text>
    </Card>
  );
}

function TranscriptBubble({
  entry,
}: {
  entry: TranscriptEntry;
}) {
  const isAgent = entry.speaker === "agent";

  return (
    <View className={isAgent ? "items-end" : "items-start"}>
      <View
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
          isAgent ? "rounded-tr-md bg-foreground" : "rounded-tl-md bg-card border border-border"
        }`}
      >
        <View className="flex-row items-center gap-1.5">
          {isAgent ? (
            <Mic size={10} strokeWidth={2} color="#fcfbf9" />
          ) : (
            <User size={10} strokeWidth={2} color="#8f8c87" />
          )}
          <Text
            className={`text-[10px] font-semibold uppercase tracking-[0.08em] ${
              isAgent ? "text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {entry.name}
          </Text>
          <Text
            font="mono"
            className={`text-[10px] ${isAgent ? "text-primary-foreground/60" : "text-muted-foreground"}`}
          >
            {entry.time}
          </Text>
        </View>

        <Text className={`mt-1 text-sm leading-snug ${isAgent ? "text-primary-foreground" : "text-foreground"}`}>
          {entry.original}
        </Text>

        {entry.translated && (
          <View className="mt-1.5 border-t border-border/60 pt-1.5">
            <View className="flex-row items-center gap-1">
              <Globe size={10} strokeWidth={2} color="#3b5dab" />
              <Text className="text-[10px] font-medium uppercase tracking-[0.08em] text-river">
                Translated
              </Text>
            </View>
            <Text className="mt-0.5 text-sm leading-snug">{entry.translated}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function CallDetailScreen() {
  const params = useLocalSearchParams<{
    number: string;
    agent: string;
    language: string;
    duration: string;
    outcome: string;
    time: string;
  }>();

  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [transcriptOpen, setTranscriptOpen] = useState(false);

  const outcome = OUTCOME_CONFIG[params.outcome as keyof typeof OUTCOME_CONFIG] ?? OUTCOME_CONFIG.resolved;
  const OutcomeIcon = outcome.icon;

  const [minutes, seconds] = params.duration.split(":").map(Number);
  const totalSeconds = minutes * 60 + (seconds || 0);
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
          <ChevronLeft size={22} strokeWidth={1.75} color="#2e2a25" />
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
        <Card className="mx-5 items-center p-6">
          {params.agent ? (
            <View className="h-16 w-16 overflow-hidden rounded-full bg-secondary">
              <Mascot seed={params.agent} size={64} />
            </View>
          ) : (
            <View className="h-16 w-16 items-center justify-center rounded-full bg-secondary">
              <Phone size={24} strokeWidth={1.75} color="#8f8c87" />
            </View>
          )}

          <Text className="mt-3 text-[20px] font-semibold">
            {params.agent || "Direct call"}
          </Text>
          <Text font="mono" variant="muted" className="mt-0.5 text-sm">
            {params.number}
          </Text>

          <Badge
            className="mt-4 px-3 py-1"
            style={{ backgroundColor: outcome.bg }}
          >
            <OutcomeIcon size={13} strokeWidth={1.75} color={outcome.color} />
            <Text style={{ color: outcome.color }} className="text-xs font-medium">
              {outcome.label}
            </Text>
          </Badge>

          <View className="mt-4 flex-row items-center gap-4">
            <View className="flex-row items-center gap-1.5">
              <CalendarDays size={12} strokeWidth={1.75} color="#8f8c87" />
              <Text variant="muted" className="text-xs">{params.time}</Text>
            </View>
            <View className="h-3 w-px bg-border" />
            <View className="flex-row items-center gap-1.5">
              <Clock size={12} strokeWidth={1.75} color="#8f8c87" />
              <Text font="mono" variant="muted" className="text-xs">{params.duration}</Text>
            </View>
          </View>
        </Card>

        {/* Stats */}
        <View className="mx-5 mt-4 flex-row gap-3">
          <StatCard
            icon={Clock}
            label="Duration"
            value={params.duration}
            caption="Total call time"
          />
          <StatCard
            icon={AudioLines}
            label="Minutes"
            value={String(usedMinutes)}
            caption="Billed minutes"
          />
          <StatCard
            icon={Globe}
            label="Language"
            value={params.language.split("→")[0].trim()}
            caption={params.language}
          />
        </View>

        {/* Recording */}
        <Card className="mx-5 mt-6 p-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <AudioLines size={15} strokeWidth={1.75} color="#3c3832" />
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
                <Pause size={16} strokeWidth={2} color="#fcfbf9" fill="#fcfbf9" />
              ) : (
                <Play size={16} strokeWidth={2} color="#fcfbf9" fill="#fcfbf9" style={{ marginLeft: 2 }} />
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
              <Download size={13} strokeWidth={1.75} color="#3c3832" />
              <Text className="text-xs font-medium">Download</Text>
            </Button>
            <Button variant="outline" className="flex-1 py-2.5">
              <Phone size={13} strokeWidth={1.75} color="#3c3832" />
              <Text className="text-xs font-medium">Share</Text>
            </Button>
          </View>
        </Card>

        {/* Transcription */}
        <Card className="mx-5 mt-6 overflow-hidden">
          <Pressable
            onPress={() => setTranscriptOpen((o) => !o)}
            className="flex-row items-center justify-between px-4 py-3.5 active:bg-secondary"
            hitSlop={4}
          >
            <View className="flex-row items-center gap-2">
              <MessageSquareText size={15} strokeWidth={1.75} color="#3c3832" />
              <Text className="text-[13px] font-semibold">Transcription</Text>
            </View>
            <View className="flex-row items-center gap-2">
              {!transcriptOpen && (
                <Text variant="muted" className="text-[11px] font-medium">
                  View transcript
                </Text>
              )}
              <ChevronDown
                size={16}
                strokeWidth={1.75}
                color="#8f8c87"
                style={{ transform: [{ rotate: transcriptOpen ? "180deg" : "0deg" }] }}
              />
            </View>
          </Pressable>

          {transcriptOpen && (
            <View className="gap-3 border-t border-border bg-canvas/50 px-4 py-4">
              {TRANSCRIPT.map((entry, index) => (
                <TranscriptBubble key={index} entry={entry} />
              ))}
            </View>
          )}
        </Card>

        {/* Actions */}
        <View className="mx-5 mt-8 flex-row gap-3">
          <Button className="flex-1 h-12">
            <Phone size={16} strokeWidth={1.75} color="#fcfbf9" />
            <Text className="text-sm font-medium text-primary-foreground">Call back</Text>
          </Button>
          <Button variant="outline" className="flex-1 h-12">
            <Mascot seed="retry-agent" size={16} />
            <Text className="text-sm font-medium">New call</Text>
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
