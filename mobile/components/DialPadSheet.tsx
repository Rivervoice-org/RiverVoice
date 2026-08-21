import { useCallback, useEffect, useRef, useState } from "react";
import { View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { Phone } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/lib/theme";
import { startCallWith } from "@/lib/start-call";

const KEYS: { digit: string; letters?: string }[] = [
  { digit: "1" },
  { digit: "2", letters: "ABC" },
  { digit: "3", letters: "DEF" },
  { digit: "4", letters: "GHI" },
  { digit: "5", letters: "JKL" },
  { digit: "6", letters: "MNO" },
  { digit: "7", letters: "PQRS" },
  { digit: "8", letters: "TUV" },
  { digit: "9", letters: "WXYZ" },
  { digit: "*" },
  { digit: "0", letters: "+" },
  { digit: "#" },
];

/**
 * Same card treatment as the app's own option pickers (ChipGroup, in
 * AgentNew/NumberNew): a rounded-xl border-border bg-card tile, opacity dim
 * on press. A dial pad drawn as a table of touching cells read as broken —
 * this is the pattern the app already uses for "pick one of several".
 */
function Key({
  digit,
  letters,
  onPress,
}: {
  digit: string;
  letters?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="h-16 w-16 items-center justify-center rounded-xl border border-border bg-card active:opacity-70"
    >
      <Text className="text-xl font-medium leading-none">{digit}</Text>
      {letters ? (
        <Text variant="muted" className="mt-1 text-[9px] font-medium tracking-[0.08em]">
          {letters}
        </Text>
      ) : (
        <View className="mt-1 h-[9px]" />
      )}
    </Pressable>
  );
}

/**
 * A dial pad that floats over the Call screen — built on @gorhom/bottom-sheet
 * rather than a hand-rolled Animated + PanResponder sheet, so drag-to-dismiss,
 * backdrop press, snap behavior, and keyboard interplay are the library's
 * battle-tested implementation instead of ours to debug.
 */
export function DialPadSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheetModal>(null);
  const [digits, setDigits] = useState("");

  useEffect(() => {
    if (visible) {
      setDigits("");
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [visible]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.25}
        pressBehavior="close"
      />
    ),
    []
  );

  function press(digit: string) {
    setDigits((d) => d + digit);
  }

  function call() {
    if (!digits) return;
    onClose();
    startCallWith({ phone: digits });
  }

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      onDismiss={onClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.canvas }}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
    >
      <BottomSheetView style={{ paddingBottom: insets.bottom + 14 }} className="px-5 pt-1">
        {/* Keypad */}
        <View className="items-center gap-2.5">
          {[0, 1, 2, 3].map((row) => (
            <View key={row} className="flex-row gap-2.5">
              {KEYS.slice(row * 3, row * 3 + 3).map((key) => (
                <Key
                  key={key.digit}
                  digit={key.digit}
                  letters={key.letters}
                  onPress={() => press(key.digit)}
                />
              ))}
            </View>
          ))}
        </View>

        {/* Call button */}
        <View className="mt-4">
          <Button size="lg" disabled={!digits} onPress={call}>
            <Phone size={16} strokeWidth={1.75} color={colors.onInk} />
            <Text className="text-sm font-medium text-primary-foreground">Call</Text>
          </Button>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
}
