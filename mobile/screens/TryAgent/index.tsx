import { useEffect, useRef, useState } from "react";
import { View, Pressable, ScrollView } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { X, PhoneOff, Mic, MicOff, Volume2, VolumeX } from "lucide-react-native";
import { Mascot } from "@/components/Mascot";
import { PulsingRing } from "@/components/PulsingRing";
import { LiveTranscript } from "@/components/LiveTranscript";
import { TranscriptPhase } from "@/components/Transcript";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/lib/theme";
import { CallStatus } from "@/lib/webrtc/ferry-call";
import { formatDuration, callStatusToPhase } from "@/lib/call-status";
import { useFerryCall } from "@/hooks/use-ferry-call";

export default function TryAgentScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    name: string;
    mascot: string;
  }>();
  const missingAgent = !params.id;

  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const agentName = params.name || "Your agent";

  const {
    status,
    conversation,
    interimCaption,
    error,
    isMuted,
    isSpeakerOn,
    startTryAgent,
    end,
    toggleMute,
    toggleSpeaker,
  } = useFerryCall();
  const phase = callStatusToPhase(status);

  const [duration, setDuration] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  // Kick off the call as soon as the screen mounts — getUserMedia() below
  // handles the mic-permission prompt itself, no separate step needed.
  // Requires a persisted agent id (the endpoint looks the agent up
  // server-side) — AgentNew's "Try agent" button saves the agent first and
  // always navigates here with one, so a missing id means a broken link,
  // not a normal state to silently recover from.
  useEffect(() => {
    if (params.id) {
      startTryAgent(params.id);
    }
  }, [startTryAgent, params.id]);

  useEffect(() => {
    if (status !== CallStatus.Connected) return;
    const interval = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [conversation, interimCaption]);

  function endCall() {
    end();
    router.back();
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3">
        <Pressable
          onPress={endCall}
          className="h-9 w-9 items-center justify-center rounded-lg active:bg-secondary"
          hitSlop={8}
        >
          <X size={20} strokeWidth={1.75} color={colors.ink} />
        </Pressable>
        <Text className="flex-1 text-center text-[17px] font-semibold">
          Try agent
        </Text>
        <View className="w-9" />
      </View>

      {/* Live status block */}
      <View className="items-center pt-4 pb-5">
        <PulsingRing active={status === CallStatus.Connected}>
          <View className="h-20 w-20 items-center justify-center rounded-full bg-secondary">
            <Mascot ref={params.mascot || undefined} seed={agentName} size={72} />
          </View>
        </PulsingRing>

        <Text className="mt-3 text-[17px] font-semibold">{agentName}</Text>

        <View className="mt-1.5 flex-row items-center gap-1.5">
          {missingAgent ? (
            <Text className="text-[13px] text-destructive">
              Missing agent — go back and try again.
            </Text>
          ) : status === CallStatus.Idle || status === CallStatus.Connecting ? (
            <Text variant="muted" className="text-[13px]">Connecting…</Text>
          ) : status === CallStatus.Connected ? (
            <>
              <View className="h-1.5 w-1.5 rounded-full bg-green" />
              <Text className="text-[13px] font-medium text-green">Live</Text>
              <View className="h-1 w-1 rounded-full bg-border" />
              <Text font="mono" variant="muted" className="text-[13px]">
                {formatDuration(duration)}
              </Text>
            </>
          ) : status === CallStatus.Error ? (
            <Text className="text-[13px] text-destructive">{error ?? "Call failed"}</Text>
          ) : (
            <Text variant="muted" className="text-[13px]">Call ended</Text>
          )}
        </View>
      </View>

      {/* Transcript — fills in with live captions and translations */}
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <LiveTranscript
          conversation={conversation}
          interim={interimCaption}
          phase={phase}
          agentName={agentName}
        />
      </ScrollView>

      {/* Footer */}
      <View
        className="flex-row items-center justify-center gap-4 border-t border-border bg-canvas px-5 pt-4"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        <Pressable
          onPress={toggleMute}
          disabled={status !== CallStatus.Connected}
          className={`h-12 w-12 items-center justify-center rounded-full border border-border active:opacity-80 ${
            isMuted ? "bg-foreground" : "bg-secondary"
          }`}
          hitSlop={8}
        >
          {isMuted ? (
            <MicOff size={18} strokeWidth={2} color={colors.onInk} />
          ) : (
            <Mic size={18} strokeWidth={2} color={colors.ink} />
          )}
        </Pressable>

        <Pressable
          onPress={toggleSpeaker}
          disabled={status !== CallStatus.Connected}
          className={`h-12 w-12 items-center justify-center rounded-full border border-border active:opacity-80 ${
            isSpeakerOn ? "bg-foreground" : "bg-secondary"
          }`}
          hitSlop={8}
        >
          {isSpeakerOn ? (
            <Volume2 size={18} strokeWidth={2} color={colors.onInk} />
          ) : (
            <VolumeX size={18} strokeWidth={2} color={colors.ink} />
          )}
        </Pressable>

        <View className="items-center">
          <Pressable
            onPress={endCall}
            className="h-14 w-14 items-center justify-center rounded-full bg-destructive active:opacity-80"
            hitSlop={8}
          >
            <PhoneOff size={22} strokeWidth={2} color={colors.onInk} />
          </Pressable>
          <Text variant="muted" className="mt-2 text-xs">
            {phase === TranscriptPhase.Ended ? "Ended" : "End call"}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
