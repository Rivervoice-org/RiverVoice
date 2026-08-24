import { memo, useCallback, useEffect, useRef, useState } from "react";
import { View, Pressable, ScrollView } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import {
  BottomSheetModal,
  BottomSheetView,
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
import { useFerryCall } from "@/hooks/use-ferry-call";

/**
 * Owns the once-a-second tick itself, in its own state, so a running call
 * doesn't force the avatar/mascot/controls around it to re-render every
 * second — only this line does.
 */
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

/**
 * The dialed person's identity — mascot, name, number — plus who's handling
 * the call underneath. Depends only on route params and whether the ring
 * should pulse, so streaming captions (which can update several times a
 * second while someone is talking) never touch this subtree: memo bails out
 * before React even reconciles it.
 */
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

/**
 * Who's actually handling the call — a static strip, memoized for the same
 * reason as CallerIdentity above.
 */
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

/**
 * A round icon button with a caption underneath, matching the native in-call
 * control layout (mute / speaker / captions as a row of three, above one big
 * red end-call circle) rather than this app's usual pill-shaped Button.
 */
const CallControl = memo(function CallControl({
  icon: Icon,
  label,
  active,
  disabled,
  onPress,
}: {
  icon: typeof Mic;
  label: string;
  active?: boolean;
  disabled?: boolean;
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
  // Only startCallWith (lib/start-call.ts) navigates here, and it always
  // includes the agent that's placing the call — a missing id means a
  // broken link, not a normal state to silently recover from.
  const missingAgent = !params.agentId;

  const {
    status,
    conversation,
    interimCaption,
    error,
    isMuted,
    isSpeakerOn,
    startCall,
    end,
    toggleMute,
    toggleSpeaker,
  } = useFerryCall();
  const phase = callStatusToPhase(status);
  // "In progress" for every purpose on this screen — pulsing avatar, enabled
  // controls — covers both the ringing/"Calling…" phase and once connected.
  // Only Idle (before start() fires) and Ended/Error should look inert.
  const callInProgress = status === CallStatus.Connecting || status === CallStatus.Connected;

  const scrollRef = useRef<ScrollView>(null);
  const captionsSheetRef = useRef<BottomSheetModal>(null);
  // Guards against double-navigating back — both the manual end-call button
  // and the status-watching effect below can each try to leave the screen
  // for the same hangup (button press flips `status` too).
  const leavingRef = useRef(false);

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
    // Dismiss first and defer the nav-triggered unmount to the next frame —
    // ending the call flips `status` (a re-render) in the same tick as
    // `router.back()` otherwise, and Fabric can race that re-render against
    // the navigator tearing down this screen (which still holds the
    // BottomSheetModal's portal content), throwing "addViewAt: failed to
    // insert view... already has a parent".
    captionsSheetRef.current?.dismiss();
    requestAnimationFrame(() => router.back());
  }, []);

  const endCall = useCallback(() => {
    end();
    leaveScreen();
  }, [end, leaveScreen]);

  // Covers a remotely-ended call (e.g. the other leg hanging up or a dial
  // failure, delivered via CALL_ENDED_TAG) — not just the local end-call
  // button, which already routes through `endCall` above.
  useEffect(() => {
    if (status === CallStatus.Ended) {
      leaveScreen();
    }
  }, [status, leaveScreen]);

  const openCaptions = useCallback(() => {
    captionsSheetRef.current?.present();
  }, []);

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
    []
  );

  return (
    <View className="flex-1 bg-canvas">
      <SafeAreaView className="flex-1" edges={["top", "bottom"]}>
        {/* Minimal header — a call has no title bar, just a way back */}
        <View className="flex-row items-center px-4 py-3">
          <Pressable
            onPress={endCall}
            className="h-9 w-9 items-center justify-center rounded-full active:bg-secondary"
            hitSlop={8}
          >
            <ChevronDown size={22} strokeWidth={2} color={colors.muted} />
          </Pressable>
        </View>

        {/* Caller ID block — the dialed person is the headline, exactly like
            a native call screen; the agent interpreting the call is a
            secondary line underneath, not the main identity. */}
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

        {/* Controls — three round toggles, then the end-call circle, same
            grouping as a native phone call screen */}
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

      {/* Captions sheet — the native call screen has no room for a
          transcript, so it lives one swipe away instead of on-screen. */}
      <BottomSheetModal
        ref={captionsSheetRef}
        snapPoints={["60%", "90%"]}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: colors.canvas }}
        handleIndicatorStyle={{ backgroundColor: colors.border }}
      >
        <BottomSheetView style={{ paddingBottom: insets.bottom + 14, flex: 1 }} className="px-4 pt-1">
          <Text className="mb-3 px-1 text-[15px] font-semibold">Captions</Text>
          <ScrollView
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 }}
          >
            <LiveTranscript
              conversation={conversation}
              interim={interimCaption}
              phase={phase}
              agentName={agentName}
            />
          </ScrollView>
        </BottomSheetView>
      </BottomSheetModal>
    </View>
  );
}
