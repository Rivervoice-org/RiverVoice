import { memo, useCallback, useEffect, useRef, useState, type ComponentRef } from "react";
import { View, Pressable } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { ChevronDown, PhoneOff, Mic, MicOff, Volume2, VolumeX, Captions } from "lucide-react-native";
import { Mascot } from "@/components/Mascot";
import { PulsingRing } from "@/components/PulsingRing";
import { LiveTranscript } from "@/components/LiveTranscript";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/lib/theme";
import { CallStatus } from "@/lib/webrtc/ferry-call";
import { formatDuration, callStatusToPhase } from "@/lib/call-status";
import { useFerryCall } from "@/hooks/use-ferry-call.mock";

const CallStatusLine = memo(function CallStatusLine({
  status,
  error,
  missingAgent,
}: {
  status: CallStatus;
  error: string | null;
  missingAgent: boolean;
}) {
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (status !== CallStatus.Connected) return;
    const interval = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(interval);
  }, [status]);

  if (missingAgent) {
    return (
      <Text variant="destructive" className="mt-3 text-[16px]">
        Missing agent — go back and try again.
      </Text>
    );
  }

  const label =
    status === CallStatus.Idle || status === CallStatus.Connecting
      ? "Calling…"
      : status === CallStatus.Connected
        ? formatDuration(duration)
        : status === CallStatus.Error
          ? "Call failed"
          : "Call ended";

  return (
    <>
      <Text
        font={status === CallStatus.Connected ? "mono" : "default"}
        variant={status === CallStatus.Error ? "destructive" : "muted"}
        className="mt-3 text-[16px]"
      >
        {label}
      </Text>
      {error && status === CallStatus.Error ? (
        <Text variant="destructive" className="mt-1 text-[13px]" numberOfLines={2}>
          {error}
        </Text>
      ) : null}
    </>
  );
});

const CallerIdentity = memo(function CallerIdentity({
  contactName,
  phone,
  mascot,
  ringing,
}: {
  contactName?: string;
  phone: string;
  mascot?: string;
  ringing: boolean;
}) {
  return (
    <>
      <PulsingRing active={ringing}>
        <View className="h-36 w-36 items-center justify-center rounded-full bg-secondary">
          <Mascot ref={mascot || undefined} seed={contactName ?? phone} size={128} />
        </View>
      </PulsingRing>

      <Text className="mt-6 text-[28px] font-semibold">{contactName ?? phone}</Text>

      {contactName ? (
        <Text font="mono" variant="muted" className="mt-1 text-[15px]">
          {phone}
        </Text>
      ) : null}
    </>
  );
});

const HandledByStrip = memo(function HandledByStrip({
  agentName,
  agentMascot,
}: {
  agentName: string;
  agentMascot?: string;
}) {
  return (
    <View className="mt-7 flex-row items-center gap-2 rounded-full bg-secondary py-1.5 pl-1.5 pr-4">
      <Mascot ref={agentMascot || undefined} seed={agentName} size={26} />
      <Text variant="muted" className="text-[13px]">
        Handled by <Text className="text-[13px] font-medium">{agentName}</Text>
      </Text>
    </View>
  );
});

const CallControl = memo(function CallControl({
  icon: Icon,
  label,
  active,
  disabled,
  badge,
  onPress,
}: {
  icon: typeof Mic;
  label: string;
  active?: boolean;
  disabled?: boolean;
  badge?: boolean;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable onPress={onPress} disabled={disabled} className="items-center gap-2" hitSlop={8}>
      <View
        className={`h-16 w-16 items-center justify-center rounded-full ${
          active ? "bg-foreground" : "bg-secondary"
        }`}
        style={{ opacity: disabled ? 0.4 : 1 }}
      >
        <Icon size={22} strokeWidth={2} color={active ? colors.onInk : colors.ink} />
        {badge && (
          <View
            className="absolute right-3 top-3 h-2 w-2 rounded-full bg-foreground"
            style={{ borderWidth: 1.5, borderColor: colors.canvas }}
          />
        )}
      </View>
      <Text variant="muted" className="text-xs font-medium">
        {label}
      </Text>
    </Pressable>
  );
});

export default function InCallScreen() {
  const params = useLocalSearchParams<{
    name?: string;
    phone: string;
    mascot?: string;
    agentId?: string;
    agentName: string;
    agentMascot?: string;
  }>();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const contactName = params.name || undefined;
  const agentName = params.agentName || "Agent";
  const missingAgent = !params.agentId;

  const {
    status,
    conversation,
    interimCaption,
    error,
    isMuted,
    isSpeakerOn,
    isAgentAudioPlaying,
    playingWordIndex,
    startCall,
    end,
    toggleMute,
    toggleSpeaker,
  } = useFerryCall();
  const phase = callStatusToPhase(status);
  const callInProgress = status === CallStatus.Connecting || status === CallStatus.Connected;

  const scrollRef = useRef<ComponentRef<typeof BottomSheetScrollView>>(null);
  const captionsSheetRef = useRef<BottomSheetModal>(null);
  const leavingRef = useRef(false);
  const sheetOpenRef = useRef(false);
  const [seenCount, setSeenCount] = useState(0);
  const hasUnseen = !sheetOpenRef.current && conversation.length > seenCount;

  useEffect(() => {
    if (params.agentId) {
      startCall(params.agentId, params.phone);
    }
  }, [startCall, params.agentId, params.phone]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [conversation, interimCaption]);

  const leaveScreen = useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    captionsSheetRef.current?.dismiss();
    requestAnimationFrame(() => router.back());
  }, []);

  const endCall = useCallback(() => {
    end();
    leaveScreen();
  }, [end, leaveScreen]);

  useEffect(() => {
    if (status === CallStatus.Ended) {
      leaveScreen();
    }
  }, [status, leaveScreen]);

  const openCaptions = useCallback(() => {
    captionsSheetRef.current?.present();
  }, []);

  const handleSheetChange = useCallback(
    (index: number) => {
      sheetOpenRef.current = index >= 0;
      if (index >= 0) {
        setSeenCount(conversation.length);
      }
    },
    [conversation.length],
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    [],
  );

  return (
    <View className="flex-1 bg-canvas">
      <SafeAreaView className="flex-1" edges={["top", "bottom"]}>
        <View className="flex-row items-center px-4 py-3">
          <Pressable
            onPress={endCall}
            className="h-9 w-9 items-center justify-center rounded-full active:bg-secondary"
            hitSlop={8}
          >
            <ChevronDown size={22} strokeWidth={2} color={colors.muted} />
          </Pressable>
        </View>

        <View className="flex-1 items-center justify-center px-8">
          <CallerIdentity
            contactName={contactName}
            phone={params.phone}
            mascot={params.mascot}
            ringing={callInProgress}
          />

          <CallStatusLine status={status} error={error} missingAgent={missingAgent} />

          <HandledByStrip agentName={agentName} agentMascot={params.agentMascot} />
        </View>

        <View className="items-center pb-4">
          <View className="flex-row gap-8">
            <CallControl
              icon={isMuted ? MicOff : Mic}
              label="Mute"
              active={isMuted}
              disabled={!callInProgress}
              onPress={toggleMute}
            />
            <CallControl
              icon={isSpeakerOn ? Volume2 : VolumeX}
              label="Speaker"
              active={isSpeakerOn}
              disabled={!callInProgress}
              onPress={toggleSpeaker}
            />
            <CallControl
              icon={Captions}
              label="Captions"
              disabled={!callInProgress}
              badge={hasUnseen}
              onPress={openCaptions}
            />
          </View>

          <View className="mt-8 items-center gap-2">
            <Pressable
              onPress={endCall}
              className="h-16 w-16 items-center justify-center rounded-full bg-destructive active:opacity-80"
              hitSlop={8}
            >
              <PhoneOff size={26} strokeWidth={2} color={colors.onInk} />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      <BottomSheetModal
        ref={captionsSheetRef}
        onChange={handleSheetChange}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: colors.canvas }}
        handleIndicatorStyle={{ backgroundColor: colors.border }}
      >
        <BottomSheetScrollView
          ref={scrollRef}
          style={{ paddingBottom: insets.bottom + 14 }}
          className="px-4 pt-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
        >
          <Text className="mb-3 px-1 text-[15px] font-semibold">Captions</Text>
          <LiveTranscript
            conversation={conversation}
            interim={interimCaption}
            phase={phase}
            agentName={agentName}
            isAgentAudioPlaying={isAgentAudioPlaying}
            playingWordIndex={playingWordIndex}
          />
        </BottomSheetScrollView>
      </BottomSheetModal>
    </View>
  );
}
