import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetTextInput,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { Phone, Delete } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useAgentPicker } from "@/hooks/use-agent-picker";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useDialTones } from "@/hooks/use-dial-tones";

/** Keeps a pasted number to what the keypad itself can produce — digits,
 * `*`, `#`, and a leading `+` — instead of carrying spaces/parens/dashes
 * into `phone`. */
function sanitizeDialInput(raw: string): string {
  const leadingPlus = raw.startsWith("+") ? "+" : "";
  return leadingPlus + raw.replace(/[^0-9*#]/g, "");
}

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
 *
 * Styling stays on `className` rather than StyleSheet objects: this project
 * compiles JSX with `jsxImportSource: "nativewind"`, so every element goes
 * through react-native-css-interop, and the `style={({ pressed }) => …}`
 * callback form that plain RN styling wants for press feedback is dropped by
 * that layer — the tiles render with no size, border, or background.
 */
const Key = memo(function Key({
  digit,
  letters,
  onPressDigit,
}: {
  digit: string;
  letters?: string | undefined;
  onPressDigit: (digit: string) => void;
}) {
  const handlePressIn = useCallback(
    () => onPressDigit(digit),
    [onPressDigit, digit],
  );

  return (
    <Pressable
      // Key-down, not key-up. A dial pad that waits for the release before it
      // makes a sound or shows a digit reads as broken no matter how fast the
      // playback itself is, and `onPress` additionally waits out Pressable's
      // tap/long-press disambiguation.
      onPressIn={handlePressIn}
      unstable_pressDelay={0}
      accessibilityRole="button"
      accessibilityLabel={digit}
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

/** Split from the body so the grid only re-renders if `onPressDigit` itself
 * changes — not on every keystroke, which is where `digits` state lives. */
const Keypad = memo(function Keypad({
  onPressDigit,
}: {
  onPressDigit: (digit: string) => void;
}) {
  return (
    <View className="mt-3 items-center gap-2.5">
      {[0, 1, 2, 3].map((row) => (
        <View key={row} className="flex-row gap-2.5">
          {KEYS.slice(row * 3, row * 3 + 3).map((key) => (
            <Key
              key={key.digit}
              digit={key.digit}
              letters={key.letters}
              onPressDigit={onPressDigit}
            />
          ))}
        </View>
      ))}
    </View>
  );
});

/** Same isolation as `Keypad` — `disabled` only changes at the
 * empty/non-empty boundary, not on every keystroke. */
const CallAction = memo(function CallAction({
  disabled,
  onPress,
  iconColor,
}: {
  disabled: boolean;
  onPress: () => void;
  iconColor: string;
}) {
  return (
    <View className="mt-4">
      <Button size="lg" disabled={disabled} onPress={onPress}>
        <Phone size={16} strokeWidth={1.75} color={iconColor} />
        <Text className="text-sm font-medium text-primary-foreground">
          Call
        </Text>
      </Button>
    </View>
  );
});

/**
 * Everything that changes as the user types, kept in its own component so a
 * keystroke re-renders this subtree and nothing above it — in particular not
 * `BottomSheetModal`, whose props would otherwise be rebuilt once per digit.
 *
 * Theme and safe-area context reach this far: both providers sit above
 * BottomSheetModalProvider in app/_layout. Session-scoped context
 * (useAgentPicker, useRequireAuth) does not, which is why placing the call is
 * a callback handed down from `DialPadSheet` rather than a hook here.
 */
const DialPadBody = memo(function DialPadBody({
  onStartCall,
  playTone,
}: {
  onStartCall: (phone: string) => void;
  playTone: (digit: string) => void;
}) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [digits, setDigits] = useState("");
  // Lets `call` stay referentially stable across keystrokes (see `CallAction`).
  const digitsRef = useRef(digits);
  digitsRef.current = digits;

  // Stable references so <Keypad>'s memo actually skips re-rendering on every
  // keystroke — inline arrow functions per key would defeat that.
  const pressDigit = useCallback(
    (digit: string) => {
      playTone(digit);
      setDigits((d) => d + digit);
    },
    [playTone],
  );

  const handleChangeText = useCallback((text: string) => {
    setDigits(sanitizeDialInput(text));
  }, []);

  const backspace = useCallback(() => {
    setDigits((d) => d.slice(0, -1));
  }, []);

  const call = useCallback(() => {
    if (digitsRef.current) onStartCall(digitsRef.current);
  }, [onStartCall]);

  const containerStyle = useMemo(
    () => ({ paddingBottom: insets.bottom + 14 }),
    [insets.bottom],
  );
  const inputStyle = useMemo(
    () => ({ color: colors.ink, textAlign: "center" as const, padding: 0 }),
    [colors.ink],
  );

  const hasDigits = digits.length > 0;

  return (
    <BottomSheetView style={containerStyle} className="px-5 pt-1">
      {/* Fixed height so it never grows into the keypad below. A real text
          input (keyboard suppressed), not a label — that's what makes
          long-press copy/paste work. */}
      <View className="h-12 flex-row items-center justify-center px-8">
        <BottomSheetTextInput
          value={digits}
          onChangeText={handleChangeText}
          placeholder="Enter a number"
          placeholderTextColor={colors.muted}
          keyboardType="phone-pad"
          showSoftInputOnFocus={false}
          // No `caretHidden` here, however much the stray blinking caret
          // wants hiding: on Android that maps to
          // TextView.setCursorVisible(false), which disables the insertion
          // controller — both the caret and the insertion handle that raises
          // the "Paste" bubble. On an empty field that handle is the only
          // route to Paste, so hiding the caret silently removes long-press
          // paste, which is the entire reason this is a TextInput and not a
          // Text.
          selectTextOnFocus
          autoCorrect={false}
          autoComplete="off"
          importantForAutofill="no"
          numberOfLines={1}
          className="flex-1 font-mono text-2xl font-medium"
          style={inputStyle}
          textAlignVertical="center"
        />
        {/* Kept mounted and merely faded out when there is nothing to delete:
            with `enableDynamicSizing` the sheet re-measures its content
            whenever the tree changes shape, and mounting this on the first
            keystroke made it re-run that measurement mid-typing. */}
        <Pressable
          onPress={backspace}
          disabled={!hasDigits}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Delete last digit"
          className={cn(
            "absolute right-0 h-9 w-9 items-center justify-center rounded-full active:bg-secondary",
            !hasDigits && "opacity-0",
          )}
        >
          <Delete size={18} strokeWidth={1.75} color={colors.muted} />
        </Pressable>
      </View>

      <Keypad onPressDigit={pressDigit} />
      <CallAction
        disabled={!hasDigits}
        onPress={call}
        iconColor={colors.onInk}
      />
    </BottomSheetView>
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
  const sheetRef = useRef<BottomSheetModal>(null);
  // Mounted with the sheet, not with its contents, so the DTMF players finish
  // loading and warming up while the sheet is still closed.
  const playTone = useDialTones();
  // Read here, not in DialPadBody: these providers live inside AppShell, below
  // the portal host that @gorhom/bottom-sheet renders sheet content into, so a
  // hook call from there throws "must be used within AgentPickerProvider".
  const { pickAgentForCall } = useAgentPicker();
  const { requireAuth } = useRequireAuth();
  // Remounts the body on each open, which is what clears the previous number —
  // cheaper and less racy than a `setDigits("")` living in the same effect that
  // presents the sheet.
  const [session, setSession] = useState(0);
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
      setSession((n) => n + 1);
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

  const startCall = useCallback(
    (phone: string) => {
      onClose();
      requireAuth(() => pickAgentForCall({ phone }));
    },
    [onClose, requireAuth, pickAgentForCall],
  );

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

  // Otherwise BottomSheetModal gets a new object identity on every render.
  const sheetBackgroundStyle = useMemo(
    () => ({ backgroundColor: colors.canvas }),
    [colors.canvas],
  );
  const sheetHandleIndicatorStyle = useMemo(
    () => ({ backgroundColor: colors.border }),
    [colors.border],
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      // The keypad fills the whole content area, so leaving the content pan
      // gesture on meant every key press first had to lose a race against the
      // sheet's drag recognizer before it could register — the single biggest
      // source of the "laggy" feel. Drag-to-dismiss stays on the handle, and
      // the backdrop still closes on press.
      enableContentPanningGesture={false}
      onChange={handleChange}
      onDismiss={handleDismiss}
      backdropComponent={renderBackdrop}
      backgroundStyle={sheetBackgroundStyle}
      handleIndicatorStyle={sheetHandleIndicatorStyle}
    >
      <DialPadBody key={session} onStartCall={startCall} playTone={playTone} />
    </BottomSheetModal>
  );
}
