import { memo, useCallback, useEffect, useRef, useState } from "react";
import { View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { Phone, Delete } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/lib/theme";
import { useAgentPicker } from "@/hooks/use-agent-picker";
import { useRequireAuth } from "@/hooks/use-require-auth";

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
 * AgentNew/VoiceCloneNew): a rounded-xl border-border bg-card tile, opacity dim
 * on press. A dial pad drawn as a table of touching cells read as broken —
 * this is the pattern the app already uses for "pick one of several".
 */
const Key = memo(function Key({
  digit,
  letters,
  onPress,
}: {
  digit: string;
  letters?: string;
  onPress: (digit: string) => void;
}) {
  return (
    <Pressable
      onPress={() => onPress(digit)}
      className="h-16 w-16 items-center justify-center rounded-xl border border-border bg-card active:opacity-70"
    >
      <Text className="text-xl font-medium leading-none">{digit}</Text>
      {letters ? (
        <Text
          variant="muted"
          className="mt-1 text-[9px] font-medium tracking-[0.08em]"
        >
          {letters}
        </Text>
      ) : (
        <View className="mt-1 h-[9px]" />
      )}
    </Pressable>
  );
});

/**
 * A dial pad that floats over the Call screen — built on @gorhom/bottom-sheet
 * rather than a hand-rolled Animated + PanResponder sheet, so drag-to-dismiss,
 * backdrop press, snap behavior, and keyboard interplay are the library's
 * battle-tested implementation instead of ours to debug.
 */
export function DialPadSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheetModal>(null);
  const [digits, setDigits] = useState("");
  const { pickAgentForCall } = useAgentPicker();
  const { requireAuth } = useRequireAuth();
  // A sheet's first-ever mount gets torn down by React StrictMode's dev-only
  // double-invoked effects — @gorhom/bottom-sheet's internal Portal fires its
  // real onDismiss as part of that simulated unmount, closing the sheet
  // immediately after present(), before the user could have dismissed it.
  // Track "we just asked it to open" so that spurious dismiss can be told
  // apart from a real one and recovered from, instead of dropping the sheet.
  const justPresentedRef = useRef(false);
  // Latest `visible`, readable from the deferred present() below — by the
  // time that timeout fires, `visible` may have already flipped back to
  // false (sheet closed for real in the meantime), and it shouldn't reopen.
  const visibleRef = useRef(visible);
  const presentTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    visibleRef.current = visible;
    if (visible) {
      setDigits("");
      justPresentedRef.current = true;
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [visible]);

  useEffect(
    () => () => {
      if (presentTimeoutRef.current) clearTimeout(presentTimeoutRef.current);
    },
    [],
  );

  const handleChange = useCallback((index: number) => {
    if (index >= 0) justPresentedRef.current = false;
  }, []);

  const handleDismiss = useCallback(() => {
    if (justPresentedRef.current) {
      justPresentedRef.current = false;
      // Deferred: this fires from inside React's own StrictMode double-invoke
      // commit pass, so re-presenting synchronously here would reenter React
      // mid-commit, before providers above (e.g. ThemeProvider) are fully
      // restored — letting content rendered by the re-present crash on
      // missing context. Let that commit finish first.
      presentTimeoutRef.current = setTimeout(() => {
        presentTimeoutRef.current = null;
        if (visibleRef.current) sheetRef.current?.present();
      }, 0);
      return;
    }
    onClose();
  }, [onClose]);

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
    [],
  );

  // Stable references so <Key>'s memo actually skips re-rendering on every
  // keystroke — inline arrow functions per key would defeat that.
  const press = useCallback((digit: string) => {
    setDigits((d) => d + digit);
  }, []);

  const backspace = useCallback(() => {
    setDigits((d) => d.slice(0, -1));
  }, []);

  const call = useCallback(() => {
    if (!digits) return;
    onClose();
    requireAuth(() => pickAgentForCall({ phone: digits }));
  }, [digits, onClose, requireAuth, pickAgentForCall]);

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      onChange={handleChange}
      onDismiss={handleDismiss}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.canvas }}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
    >
      <BottomSheetView
        style={{ paddingBottom: insets.bottom + 14 }}
        className="px-5 pt-1"
      >
        {/* Number being dialed — fixed height so it never grows into the
            keypad below and forces a resize animation mid-typing. */}
        <View className="h-12 flex-row items-center justify-center px-8">
          <Text
            font="mono"
            numberOfLines={1}
            className="flex-1 text-center text-2xl font-medium"
            style={digits ? undefined : { opacity: 0.35 }}
          >
            {digits || "Enter a number"}
          </Text>
          {digits ? (
            <Pressable
              onPress={backspace}
              hitSlop={10}
              className="absolute right-0 h-9 w-9 items-center justify-center rounded-full active:bg-secondary"
            >
              <Delete size={18} strokeWidth={1.75} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>

        {/* Keypad */}
        <View className="mt-3 items-center gap-2.5">
          {[0, 1, 2, 3].map((row) => (
            <View key={row} className="flex-row gap-2.5">
              {KEYS.slice(row * 3, row * 3 + 3).map((key) => (
                <Key
                  key={key.digit}
                  digit={key.digit}
                  letters={key.letters}
                  onPress={press}
                />
              ))}
            </View>
          ))}
        </View>

        {/* Call button */}
        <View className="mt-4">
          <Button size="lg" disabled={!digits} onPress={call}>
            <Phone size={16} strokeWidth={1.75} color={colors.onInk} />
            <Text className="text-sm font-medium text-primary-foreground">
              Call
            </Text>
          </Button>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
}
