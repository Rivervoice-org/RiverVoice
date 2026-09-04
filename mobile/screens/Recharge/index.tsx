import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { CheckCircle2, ChevronLeft, Coins } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Rise } from "@/components/ui/rise";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { useThemeColors } from "@/lib/theme";

// Mocked: no payment provider is wired up yet — this just simulates a
// recharge and, in a real build, would hand off to whatever gateway (Razorpay
// et al.) actually charges the card/UPI and only then tells ferry to write a
// `credit_ledger` row with entry_type: 'topup' (see the credits schema
// discussion — ferry/src/db/entity/credit_ledger.rs).
const MIN_RECHARGE_RUPEES = 10;
const QUICK_AMOUNTS = [50, 100, 200, 500, 1000];

// 1 credit = ₹1 (see ferry/src/observer/billing_observer.rs's
// MICROS_PER_CREDIT), so a recharge amount in rupees is the credit amount,
// with no conversion needed.
const CURRENT_BALANCE = 3580;

function parseAmount(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export default function RechargeScreen() {
  const colors = useThemeColors();
  const [amountInput, setAmountInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [rechargedAmount, setRechargedAmount] = useState<number | null>(null);

  const amount = useMemo(() => parseAmount(amountInput), [amountInput]);
  const isValid = amount !== null && amount >= MIN_RECHARGE_RUPEES;
  const showMinError = amount !== null && amount < MIN_RECHARGE_RUPEES;

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
            <View className="h-16 w-16 items-center justify-center rounded-full bg-green-tint">
              <CheckCircle2 size={30} strokeWidth={1.75} color={colors.green} />
            </View>
          </Rise>
          <Rise index={1}>
            <Text className="mt-5 text-center text-[20px] font-semibold">
              Recharge successful
            </Text>
            <Text variant="muted" className="mt-1.5 text-center text-sm">
              {rechargedAmount.toLocaleString()} credits added to your balance.
            </Text>
          </Rise>
          <Rise index={2}>
            <Button
              size="lg"
              className="mt-8 w-full"
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

      <View className="flex-1 px-5">
        <Rise index={0}>
          <Card className="mt-1 flex-row items-center justify-between p-4">
            <Text variant="muted" className="text-xs">
              Current balance
            </Text>
            <View className="flex-row items-center gap-1.5">
              <Coins size={14} strokeWidth={1.75} color={colors.muted} />
              <Text font="mono" className="text-sm font-semibold">
                {CURRENT_BALANCE.toLocaleString()}
              </Text>
            </View>
          </Card>
        </Rise>

        <Rise index={1}>
          <Text
            variant="muted"
            className="mb-2 mt-6 text-[11px] font-medium uppercase tracking-[0.14em]"
          >
            Amount
          </Text>
          <View className="flex-row items-center rounded-lg border border-border bg-card px-3">
            <Text className="text-lg font-semibold text-muted-foreground">
              ₹
            </Text>
            <Input
              className="h-14 flex-1 border-0 bg-transparent px-2 text-[22px] font-semibold"
              value={amountInput}
              onChangeText={(text) =>
                setAmountInput(text.replace(/[^\d]/g, ""))
              }
              placeholder="0"
              keyboardType="number-pad"
              maxLength={6}
            />
          </View>
          {showMinError ? (
            <Text variant="destructive" className="mt-1.5 text-xs">
              Minimum recharge is ₹{MIN_RECHARGE_RUPEES}
            </Text>
          ) : null}
        </Rise>

        <Rise index={2}>
          <View className="mt-4 flex-row flex-wrap gap-2">
            {QUICK_AMOUNTS.map((value) => {
              const selected = amount === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setAmountInput(String(value))}
                  className={cn(
                    "rounded-full border px-4 py-2 active:opacity-80",
                    selected
                      ? "border-foreground bg-foreground"
                      : "border-border bg-card",
                  )}
                >
                  <Text
                    className={cn(
                      "text-sm font-medium",
                      selected ? "text-primary-foreground" : "text-foreground",
                    )}
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
