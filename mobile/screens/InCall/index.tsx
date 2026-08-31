import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
} from "react";
import { View, Pressable, BackHandler } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { PhoneOff, Phone, Mic, MicOff, Captions } from "lucide-react-native";
import { Mascot } from "@/components/Mascot";
import { InitialsAvatar } from "@/components/InitialsAvatar";
import { PulsingRing } from "@/components/PulsingRing";
import {
  CallTranscript,
  type CallTranscriptLine,
} from "@/components/call-transcript";
import {
  AudioRoutePickerSheet,
  type AudioRoutePickerHandle,
} from "@/components/AudioRoutePickerSheet";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/lib/theme";
import { AudioDevice, CallStatus } from "@/lib/webrtc/ferry-call";
import { callStatusLabel } from "@/lib/call-status";
import { AUDIO_ROUTE_ICONS, AUDIO_ROUTE_LABELS } from "@/lib/audio-route";
import { LiveSpeaker, useFerryCall } from "@/hooks/use-ferry-call";
import { recentCallsQueryKey } from "@/lib/calls/hooks";
import { recentAgentsQueryKey } from "@/lib/agents/hooks";
import { minimize } from "@kangfenmao/react-native-minimizer";
import notifee, { AndroidImportance } from "@notifee/react-native";
// import * as Notifications from "expo-notifications";

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

  const label = callStatusLabel(status, duration);

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
        <Text
          variant="destructive"
          className="mt-1 text-[13px]"
          numberOfLines={2}
        >
          {error}
        </Text>
      ) : null}
    </>
  );
});

const CallerIdentity = memo(function CallerIdentity({
  contactName,
  phone,
  ringing,
}: {
  contactName?: string | undefined;
  phone: string;
  ringing: boolean;
}) {
  const colors = useThemeColors();
  return (
    <>
      <PulsingRing active={ringing}>
        <View className="h-36 w-36 items-center justify-center rounded-full bg-secondary">
          {contactName ? (
            <InitialsAvatar name={contactName} size={128} />
          ) : (
            <Phone size={48} strokeWidth={1.75} color={colors.muted} />
          )}
        </View>
      </PulsingRing>

      <Text className="mt-6 text-[28px] font-semibold">
        {contactName ?? phone}
      </Text>

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
  agentMascot?: string | undefined;
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
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="items-center gap-2"
      hitSlop={8}
    >
      <View
        className={`h-16 w-16 items-center justify-center rounded-full ${
          active ? "bg-foreground" : "bg-secondary"
        }`}
        style={{ opacity: disabled ? 0.4 : 1 }}
      >
        <Icon
          size={22}
          strokeWidth={2}
          color={active ? colors.onInk : colors.ink}
        />
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
    audioDevices,
    activeAudioDevice,
    startCall,
    end,
    toggleMute,
    chooseAudioRoute,
  } = useFerryCall();
  const callInProgress =
    status === CallStatus.Connecting ||
    status === CallStatus.Ringing ||
    status === CallStatus.Connected;
  const isRinging = status === CallStatus.Ringing;

  const scrollRef = useRef<ComponentRef<typeof BottomSheetScrollView>>(null);
  const captionsSheetRef = useRef<BottomSheetModal>(null);
  const audioRouteSheetRef = useRef<AudioRoutePickerHandle>(null);
  const queryClient = useQueryClient();
  const leavingRef = useRef(false);
  const sheetOpenRef = useRef(false);
  const [seenCount, setSeenCount] = useState(0);
  const hasUnseen = !sheetOpenRef.current && conversation.length > seenCount;

  // A live call gives one language per line — your caption, then the
  // translation the other side hears — so there is no second language to
  // reveal under a bubble the way a finished transcript has. `spoken` stays
  // null and the shared renderer simply draws one text per bubble.
  const captionLines = useMemo<CallTranscriptLine[]>(
    () =>
      conversation.map((line, index) => ({
        key: String(index),
        mine: line.speaker === LiveSpeaker.Caller,
        text: line.text,
      })),
    [conversation],
  );

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
    // The call that just ended is a new row in the history, and it moved its
    // agent to the top of "recently used" with one more call to its name —
    // both of Home's lists are stale the moment this screen closes.
    void queryClient.invalidateQueries({ queryKey: recentCallsQueryKey });
    void queryClient.invalidateQueries({ queryKey: recentAgentsQueryKey });
    captionsSheetRef.current?.dismiss();
    requestAnimationFrame(() => router.back());
  }, [queryClient]);

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

  const openAudioRoute = useCallback(() => {
    audioRouteSheetRef.current?.present();
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

  useEffect(() => {
    const handleBack = () => {
      console.log("Back button clicked");
      handleNotification().then(()=>minimize()).catch((error) => {
        console.error("Notification error:", error);
      });



      return true;
    };

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      handleBack,
    );

    return () => {
      subscription.remove();
    };
  }, []);

  async function handleNotification() {
    try {
      await notifee.requestPermission();

      const channelId = await notifee.createChannel({
        id: "running-state",
        name: "Call In Progress",
        importance: AndroidImportance.LOW,
      });

      console.log("Channel created:", channelId);

      await notifee.displayNotification({
        id: "call-notification",
        title: "There is an Ongoing Call",
        body: "Tap to Return to the App",
        android: {
          channelId,
          ongoing: true,
          asForegroundService: true,
        },
      });

      console.log("Notification displayed");
    } catch (error) {
      console.error("Failed to display notification:", error);
    }
  }

  return (
    <View className="flex-1 bg-canvas">
      <SafeAreaView className="flex-1" edges={["top", "bottom"]}>
        <View className="flex-1 items-center justify-center px-8">
          <CallerIdentity
            contactName={contactName}
            phone={params.phone}
            ringing={isRinging}
          />

          <CallStatusLine
            status={status}
            error={error}
            missingAgent={missingAgent}
          />

          <HandledByStrip
            agentName={agentName}
            agentMascot={params.agentMascot}
          />
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
              icon={
                activeAudioDevice === AudioDevice.None
                  ? AUDIO_ROUTE_ICONS[AudioDevice.SpeakerPhone]
                  : AUDIO_ROUTE_ICONS[activeAudioDevice]
              }
              label={
                activeAudioDevice === AudioDevice.None
                  ? "Audio"
                  : AUDIO_ROUTE_LABELS[activeAudioDevice]
              }
              active={activeAudioDevice === AudioDevice.SpeakerPhone}
              disabled={!callInProgress || audioDevices.length === 0}
              onPress={openAudioRoute}
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
          <CallTranscript lines={captionLines} interim={interimCaption} />
        </BottomSheetScrollView>
      </BottomSheetModal>

      <AudioRoutePickerSheet
        ref={audioRouteSheetRef}
        devices={audioDevices}
        active={activeAudioDevice}
        onSelect={chooseAudioRoute}
      />
    </View>
  );
}
