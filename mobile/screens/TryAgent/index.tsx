import { useEffect, useRef, useState } from "react";
import { View, Pressable, ScrollView, Animated, Easing } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { X, PhoneOff, Mic, Globe } from "lucide-react-native";
import { Mascot } from "@/components/Mascot";
import { Text } from "@/components/ui/text";
import { TRY_AGENT_SCRIPT } from "./mock";

const REVEAL_INTERVAL_MS = 1800;

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
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

export default function TryAgentScreen() {
  const params = useLocalSearchParams<{
    name: string;
    mascot: string;
  }>();

  const insets = useSafeAreaInsets();
  const agentName = params.name || "Your agent";

  const [phase, setPhase] = useState<"connecting" | "live" | "ended">("connecting");
  const [revealed, setRevealed] = useState(0);
  const [duration, setDuration] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const connectTimeout = setTimeout(() => setPhase("live"), 1100);
    return () => clearTimeout(connectTimeout);
  }, []);

  useEffect(() => {
    if (phase !== "live") return;

    const durationInterval = setInterval(() => setDuration((d) => d + 1), 1000);
    const revealInterval = setInterval(() => {
      setRevealed((count) => {
        const next = count + 1;
        if (next >= TRY_AGENT_SCRIPT.length) {
          clearInterval(revealInterval);
          setTimeout(() => setPhase("ended"), 1200);
        }
        return next;
      });
    }, REVEAL_INTERVAL_MS);

    return () => {
      clearInterval(durationInterval);
      clearInterval(revealInterval);
    };
  }, [phase]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [revealed]);

  const activeEntry = revealed > 0 ? TRY_AGENT_SCRIPT[revealed - 1] : null;
  const agentSpeaking = phase === "live" && activeEntry?.speaker === "agent";
  const callerSpeaking = phase === "live" && activeEntry?.speaker === "caller";

  function endCall() {
    setPhase("ended");
    router.back();
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
          <X size={20} strokeWidth={1.75} color="#2e2a25" />
        </Pressable>
        <Text className="flex-1 text-center text-[17px] font-semibold">
          Try agent
        </Text>
        <View className="w-9" />
      </View>

      {/* Live status block */}
      <View className="items-center pt-4 pb-5">
        <PulsingRing active={agentSpeaking}>
          <View className="h-20 w-20 items-center justify-center rounded-full bg-secondary">
            <Mascot ref={params.mascot || undefined} seed={agentName} size={72} />
          </View>
        </PulsingRing>

        <Text className="mt-3 text-[17px] font-semibold">{agentName}</Text>

        <View className="mt-1.5 flex-row items-center gap-1.5">
          {phase === "connecting" && (
            <Text variant="muted" className="text-[13px]">Connecting…</Text>
          )}
          {phase === "live" && (
            <>
              <View className="h-1.5 w-1.5 rounded-full bg-[#2a8c4d]" />
              <Text className="text-[13px] font-medium text-[#2a8c4d]">Live</Text>
              <Text variant="muted" className="text-[13px]">·</Text>
              <Text font="mono" variant="muted" className="text-[13px]">
                {formatDuration(duration)}
              </Text>
            </>
          )}
          {phase === "ended" && (
            <Text variant="muted" className="text-[13px]">Call ended</Text>
          )}
        </View>
      </View>

      {/* Transcript — fills in as the mock call plays out */}
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-3">
          {TRY_AGENT_SCRIPT.slice(0, revealed).map((entry, index) => {
            const isAgent = entry.speaker === "agent";
            const isActive = index === revealed - 1 && phase === "live";
            return (
              <View key={index} className={isAgent ? "items-end" : "items-start"}>
                <View
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
                    isAgent
                      ? "rounded-tr-md bg-foreground"
                      : "rounded-tl-md border border-border bg-card"
                  }`}
                >
                  <View className="flex-row items-center gap-1.5">
                    {isAgent ? (
                      <Mic size={10} strokeWidth={2} color="#fcfbf9" />
                    ) : (
                      <Mic size={10} strokeWidth={2} color="#8f8c87" />
                    )}
                    <Text
                      className={`text-[10px] font-semibold uppercase tracking-[0.08em] ${
                        isAgent ? "text-primary-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {isAgent ? agentName : "You"}
                    </Text>
                    {isActive && (
                      <View
                        className={`h-1.5 w-1.5 rounded-full ${
                          isAgent ? "bg-primary-foreground/70" : "bg-[#2a8c4d]"
                        }`}
                      />
                    )}
                  </View>

                  <Text
                    className={`mt-1 text-sm leading-snug ${
                      isAgent ? "text-primary-foreground" : "text-foreground"
                    }`}
                  >
                    {entry.text}
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
          })}

          {phase === "live" && revealed < TRY_AGENT_SCRIPT.length && (
            <View className={callerSpeaking ? "items-start" : "items-end"}>
              <View
                className={`flex-row items-center gap-1 rounded-2xl px-3.5 py-2.5 ${
                  callerSpeaking ? "border border-border bg-card" : "bg-foreground"
                }`}
              >
                {[0, 1, 2].map((i) => (
                  <View
                    key={i}
                    className={`h-1.5 w-1.5 rounded-full ${
                      callerSpeaking ? "bg-muted-foreground" : "bg-primary-foreground/70"
                    }`}
                  />
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Footer */}
      <View
        className="items-center border-t border-border bg-canvas px-5 pt-4"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        <Pressable
          onPress={endCall}
          className="h-14 w-14 items-center justify-center rounded-full bg-destructive active:opacity-80"
          hitSlop={8}
        >
          <PhoneOff size={22} strokeWidth={2} color="#fcfbf9" />
        </Pressable>
        <Text variant="muted" className="mt-2 text-xs">
          {phase === "ended" ? "Ended" : "End call"}
        </Text>
      </View>
    </SafeAreaView>
  );
}
