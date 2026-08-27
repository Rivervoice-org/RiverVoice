import { useCallback, useImperativeHandle, useRef, type Ref } from "react";
import { Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { Check } from "lucide-react-native";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/lib/theme";
import {
  AUDIO_ROUTE_ICONS,
  AUDIO_ROUTE_LABELS,
  AUDIO_ROUTE_ORDER,
} from "@/lib/audio-route";
import type { AudioDevice } from "@/lib/webrtc/ferry-call";

export type AudioRoutePickerHandle = {
  present: () => void;
  dismiss: () => void;
};

/**
 * The WhatsApp/iOS-style "which output is call audio on" sheet — lists
 * whatever InCallManager currently reports as available (earpiece/speaker
 * are always present; wired headset/Bluetooth only show up once actually
 * connected) and lets the user explicitly switch, rather than only ever
 * seeing a binary speaker on/off toggle.
 */
export function AudioRoutePickerSheet({
  ref,
  devices,
  active,
  onSelect,
}: {
  ref?: Ref<AudioRoutePickerHandle>;
  devices: AudioDevice[];
  active: AudioDevice;
  onSelect: (device: AudioDevice) => void;
}) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheetModal>(null);

  useImperativeHandle(
    ref,
    () => ({
      present: () => sheetRef.current?.present(),
      dismiss: () => sheetRef.current?.dismiss(),
    }),
    [],
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

  const available = AUDIO_ROUTE_ORDER.filter((device) =>
    devices.includes(device),
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.canvas }}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
    >
      <BottomSheetView
        style={{ paddingBottom: insets.bottom + 14 }}
        className="px-5 pt-1"
      >
        <Text className="mb-3 text-base font-semibold">Audio output</Text>

        {available.length === 0 ? (
          <Text variant="muted" className="px-1 py-3 text-[13px]">
            No audio outputs available yet
          </Text>
        ) : (
          <Card className="overflow-hidden">
            {available.map((device, index) => {
              const Icon = AUDIO_ROUTE_ICONS[device];
              const isActive = device === active;
              return (
                <Pressable
                  key={device}
                  onPress={() => {
                    onSelect(device);
                    sheetRef.current?.dismiss();
                  }}
                  className={`flex-row items-center gap-3 px-4 py-3.5 active:bg-secondary ${
                    index !== available.length - 1
                      ? "border-b border-border"
                      : ""
                  }`}
                >
                  <Icon size={18} strokeWidth={1.75} color={colors.ink} />
                  <Text className="flex-1 text-[15px]">
                    {AUDIO_ROUTE_LABELS[device]}
                  </Text>
                  {isActive ? (
                    <Check size={18} strokeWidth={2} color={colors.ink} />
                  ) : null}
                </Pressable>
              );
            })}
          </Card>
        )}
      </BottomSheetView>
    </BottomSheetModal>
  );
}
