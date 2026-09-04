import { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft, Coins } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Rise } from "@/components/ui/rise";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { useThemeColors } from "@/lib/theme";
import { useCreditBalance } from "@/lib/credits/hooks";

// The recharge action itself is still mocked: no payment provider is wired
// up yet, so submitting here never actually writes a `credit_ledger` topup
// row — the balance line at the top, though, is real (see useCreditBalance),
// which is why the success screen counts up the amount just added rather
// than claiming a specific new total: that total isn't actually persisted,
// so showing one would contradict itself the moment this screen is left. In
// a real build, submitting would hand off to whatever gateway (Razorpay et
// al.) actually charges the card/UPI and only then tells ferry to write
// that row.
const MIN_RECHARGE_RUPEES = 10;
// Real INR note denominations, not arbitrary round numbers.
const QUICK_AMOUNTS = [50, 100, 200, 500, 1000];

function parseAmount(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

// Approximate advance width of one Geist Mono digit at the input's 60px
// size — the input's width is sized to the digit count so a longer amount
// grows the box instead of scrolling its leading digits out of view.
const DIGIT_WIDTH = 38;

/** Counts 0 -> `target` once `active`, eased out — the one deliberate
 * motion on the success screen, answering the recharge with a number that
 * visibly climbs to what was just added rather than a static readout. */
function useCountUp(target: number, active: boolean, durationMs = 700) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    let raf: ReturnType<typeof requestAnimationFrame>;
    const start = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / durationMs);
      const eased = 1 - (1 - t) ** 3;
      setValue(Math.round(eased * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active, durationMs]);
  return value;
}

export default function RechargeScreen() {
  const colors = useThemeColors();
  const { data: balance, isLoading: isBalanceLoading } = useCreditBalance();
  const [amountInput, setAmountInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [rechargedAmount, setRechargedAmount] = useState<number | null>(null);

  const amount = useMemo(() => parseAmount(amountInput), [amountInput]);
  const isValid = amount !== null && amount >= MIN_RECHARGE_RUPEES;
  const showMinError = amount !== null && amount < MIN_RECHARGE_RUPEES;
  const tally = useCountUp(rechargedAmount ?? 0, rechargedAmount !== null);

  function handleRecharge() {
    if (!isValid) return;
    setSubmitting(true);
    // Simulated network round-trip to a payment gateway.
    setTimeout(() => {
      setSubmitting(false);
      setRechargedAmount(amount);
    }, 900);
  }

  if (rechargedAmount !== null) {
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
        <View className="flex-1 items-center justify-center px-8">
          <Rise index={0}>
            <View className="h-20 w-20 items-center justify-center rounded-full bg-green-tint">
              <Coins size={30} strokeWidth={1.75} color={colors.green} />
            </View>
          </Rise>
          <Rise index={1}>
            <View className="mt-6 flex-row items-baseline">
              <Text
                font="mono"
                className="text-[15px] font-semibold text-green"
              >
                +
              </Text>
              <Text
                font="mono"
                className="text-[44px] font-semibold tabular-nums text-green"
              >
                {tally.toLocaleString()}
              </Text>
            </View>
            <Text variant="muted" className="mt-1 text-center text-sm">
              credits added to your balance
            </Text>
          </Rise>
          <Rise index={2}>
            <Button
              size="lg"
              className="mt-10 w-full"
              onPress={() => router.back()}
            >
              Done
            </Button>
          </Rise>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <View className="flex-row items-center px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          className="h-9 w-9 items-center justify-center rounded-lg active:bg-secondary"
          hitSlop={8}
        >
          <ChevronLeft size={22} strokeWidth={1.75} color={colors.ink} />
        </Pressable>
        <Text className="flex-1 text-center text-[17px] font-semibold">
          Recharge
        </Text>
        <View className="w-9" />
      </View>

      <Rise index={0}>
        <View className="flex-row items-center justify-center gap-1.5 pt-2">
          <Coins size={12} strokeWidth={1.75} color={colors.muted} />
          {isBalanceLoading ? (
            <Skeleton className="h-3 w-20 rounded-full" />
          ) : (
            <Text variant="muted" className="text-xs">
              {(balance?.remaining ?? 0).toLocaleString()} credits available
            </Text>
          )}
        </View>
      </Rise>

      <View className="flex-1 items-center justify-center px-8">
        <Rise index={1}>
          <View className="items-center">
            <View className="flex-row items-end justify-center gap-1">
              <Text
                font="mono"
                className={cn(
                  "pb-2 text-[26px] font-semibold",
                  isValid ? "text-river" : "text-muted-foreground",
                )}
              >
                ₹
              </Text>
              <Input
                className={cn(
                  "h-20 border-0 bg-transparent px-1 text-center font-mono text-[60px] font-semibold tabular-nums",
                  isValid ? "text-river" : "text-foreground",
                )}
                style={{
                  width: Math.max(amountInput.length, 1) * DIGIT_WIDTH,
                }}
                value={amountInput}
                onChangeText={(text) => {
                  const digits = text
                    .replace(/[^\d]/g, "")
                    .replace(/^0+(?=\d)/, "");
                  setAmountInput(digits);
                }}
                placeholder="0"
                placeholderTextColor={colors.faint}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />
            </View>
            <View
              className="mt-1 h-1 w-40 rounded-full"
              style={{
                backgroundColor: showMinError
                  ? colors.destructive
                  : isValid
                    ? colors.river
                    : colors.border,
              }}
            />
            {showMinError ? (
              <Text variant="destructive" className="mt-3 text-xs">
                Minimum recharge is ₹{MIN_RECHARGE_RUPEES}
              </Text>
            ) : null}
          </View>
        </Rise>

        <Rise index={2}>
          <View className="mt-8 flex-row flex-wrap justify-center gap-2">
            {QUICK_AMOUNTS.map((value) => {
              const selected = amount === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setAmountInput(String(value))}
                  className={cn(
                    "rounded-full border px-4 py-2 active:opacity-80",
                    selected
                      ? "border-river bg-river"
                      : "border-border bg-card",
                  )}
                >
                  <Text
                    font="mono"
                    className="text-sm font-medium"
                    style={selected ? { color: colors.onInk } : undefined}
                  >
                    ₹{value.toLocaleString()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Rise>
      </View>

      <Rise index={3}>
        <View className="px-5 pb-6">
          <Button
            size="lg"
            className="w-full"
            disabled={!isValid}
            loading={submitting}
            onPress={handleRecharge}
          >
            {amount ? `Recharge ₹${amount.toLocaleString()}` : "Recharge"}
          </Button>
        </View>
      </Rise>
    </SafeAreaView>
  );
}
