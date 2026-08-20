import { memo, useEffect, useRef, useState } from "react";
import { View, Pressable, ScrollView, Animated, Easing } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { X, PhoneOff, Mic, MicOff, Globe } from "lucide-react-native";
import { Mascot } from "@/components/Mascot";
import { TranscriptPhase } from "@/components/Transcript";
import { Text } from "@/components/ui/text";
import { CallStatus } from "@/lib/webrtc/ferry-call";
import { Speaker, useFerryCall, type ConversationLine } from "@/hooks/use-ferry-call";

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function callStatusToPhase(status: CallStatus): TranscriptPhase {
  switch (status) {
    case CallStatus.Connected:
      return TranscriptPhase.Live;
    case CallStatus.Ended:
    case CallStatus.Error:
      return TranscriptPhase.Ended;
    default:
      return TranscriptPhase.Connecting;
  }
}

function PulsingRing({ active, children }: { active: boolean; children: React.ReactNode }) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active) {
      scale.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.12,
          duration: 700,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 700,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active, scale]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>
  );
}

/**
 * Live conversation: your captioned speech ("caller") interleaved with
 * ferry's translated text ("agent") — both come off the same data channel
 * from ferry/src/stages/stt.rs (Transcription frames) and
 * ferry/src/stages/tts.rs (MtText frames), already in true chronological
 * order by the time they reach `conversation`. Only the translated *text*
 * is captioned here; the agent's actual voice comes back separately over
 * the WebRTC audio track, not through this data channel.
 *
 * Memoized so the per-second duration tick in the screen never re-renders
 * the bubbles — this only changes when a new line arrives.
 */
const Transcript = memo(function Transcript({
  conversation,
  interim,
  phase,
  agentName,
}: {
  conversation: ConversationLine[];
  interim: string;
  phase: TranscriptPhase;
  agentName: string;
}) {
  return (
    <View className="gap-3">
      {conversation.map((line, index) => {
        const isAgent = line.speaker === Speaker.Agent;
        return (
          <View key={index} className={isAgent ? "items-end" : "items-start"}>
            <View
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
                isAgent
                  ? "rounded-tr-md border border-border bg-card"
                  : "rounded-tl-md border border-border bg-secondary"
              }`}
            >
              <View className="flex-row items-center gap-1.5">
                {isAgent ? (
                  <Globe size={10} strokeWidth={2} color="#3b5dab" />
                ) : (
                  <Mic size={10} strokeWidth={2} color="#8f8c87" />
                )}
                <Text
                  className={`text-[10px] font-semibold uppercase tracking-[0.08em] ${
                    isAgent ? "text-muted-foreground" : "text-foreground"
                  }`}
                >
                  {isAgent ? agentName : "You"}
                </Text>
              </View>
              <Text className="mt-1 text-sm leading-snug text-foreground">{line.text}</Text>
            </View>
          </View>
        );
      })}

      {phase === TranscriptPhase.Live && interim.length > 0 && (
        <View className="items-start">
          <View className="max-w-[85%] rounded-2xl rounded-tl-md border border-border bg-secondary px-3.5 py-2.5">
            <View className="flex-row items-center gap-1.5">
              <Mic size={10} strokeWidth={2} color="#8f8c87" />
              <Text className="text-[10px] font-semibold uppercase tracking-[0.08em] text-foreground">
                You
              </Text>
              <View className="h-1.5 w-1.5 rounded-full bg-[#2a8c4d]" />
            </View>
            <Text className="mt-1 text-sm leading-snug text-muted-foreground">{interim}</Text>
          </View>
        </View>
      )}
    </View>
  );
});

export default function TryAgentScreen() {
  const params = useLocalSearchParams<{
    name: string;
    mascot: string;
  }>();

  const insets = useSafeAreaInsets();
  const agentName = params.name || "Your agent";

  const { status, conversation, interimCaption, error, isMuted, start, end, toggleMute } =
    useFerryCall();
  const phase = callStatusToPhase(status);

  const [duration, setDuration] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  // Kick off the call as soon as the screen mounts — getUserMedia() below
  // handles the mic-permission prompt itself, no separate step needed.
  useEffect(() => {
    start();
  }, [start]);

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
          <X size={20} strokeWidth={1.75} color="#2e2a25" />
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
          {status === CallStatus.Idle || status === CallStatus.Connecting ? (
            <Text variant="muted" className="text-[13px]">Connecting…</Text>
          ) : status === CallStatus.Connected ? (
            <>
              <View className="h-1.5 w-1.5 rounded-full bg-[#2a8c4d]" />
              <Text className="text-[13px] font-medium text-[#2a8c4d]">Live</Text>
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
        <Transcript
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
            <MicOff size={18} strokeWidth={2} color="#fcfbf9" />
          ) : (
            <Mic size={18} strokeWidth={2} color="#2e2a25" />
          )}
        </Pressable>

        <View className="items-center">
          <Pressable
            onPress={endCall}
            className="h-14 w-14 items-center justify-center rounded-full bg-destructive active:opacity-80"
            hitSlop={8}
          >
            <PhoneOff size={22} strokeWidth={2} color="#fcfbf9" />
          </Pressable>
          <Text variant="muted" className="mt-2 text-xs">
            {phase === TranscriptPhase.Ended ? "Ended" : "End call"}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
