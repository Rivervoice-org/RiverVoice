import { useState } from "react";
import { View, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { router } from "expo-router";
import { ChevronLeft, Waves } from "lucide-react-native";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/lib/theme";

const COUNTRY_CODE = "+91";

/** "9876543210" → "98765 43210" as it is typed. */
function formatPhone(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  return digits.length > 5
    ? `${digits.slice(0, 5)} ${digits.slice(5)}`
    : digits;
}

export default function ContinueWithNumberScreen() {
  const colors = useThemeColors();
  const { continueWithNumber } = useAuth();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setError("Enter a valid phone number.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await continueWithNumber(digits);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-canvas"
    >
      <View className="flex-1 px-6">
        {/* Back button, top-left */}
        <View className="pt-12">
          <Pressable
            onPress={() => router.back()}
            className="h-9 w-9 items-center justify-center rounded-lg active:bg-secondary"
            hitSlop={8}
            accessibilityLabel="Go back"
          >
            <ChevronLeft size={22} strokeWidth={1.75} color={colors.ink} />
          </Pressable>
        </View>

        <View className="mt-4 items-center">
          <View className="h-12 w-12 items-center justify-center rounded-2xl border border-border bg-card shadow-float">
            <Waves size={24} strokeWidth={2} color={colors.ink} />
          </View>
          <Text className="mt-4 text-[17px] font-semibold tracking-[-0.02em]">
            Rivervoice
          </Text>
        </View>

        <View className="w-full max-w-sm flex-1 self-center justify-center">
          <Text className="text-[24px] font-semibold tracking-tight">
            Continue with number
          </Text>
          <Text variant="muted" className="mt-1.5 text-sm">
            No passwords to remember — just your phone.
          </Text>

          <View className="mt-7 flex-row items-center rounded-lg border border-border bg-card px-3.5">
            <Text className="text-[15px] font-medium">{COUNTRY_CODE}</Text>
            <View className="mx-3 h-5 w-px bg-border" />
            <Input
              className="h-12 flex-1 border-0 bg-transparent px-0 text-[15px]"
              placeholder="98765 43210"
              placeholderTextColor={colors.faint}
              value={phone}
              onChangeText={(text) => {
                setPhone(formatPhone(text));
                setError("");
              }}
              keyboardType="phone-pad"
              autoComplete="tel"
            />
          </View>

          {error ? (
            <Text variant="destructive" className="mt-2 text-[13px]">
              {error}
            </Text>
          ) : null}

          <Button onPress={handleSubmit} loading={loading} className="mt-3">
            Continue with number
          </Button>
        </View>

        {/* Quiet footer, like Notion's Terms · Privacy line */}
        <View className="items-center pb-10">
          <Text variant="muted" className="text-center text-[11px]">
            © Rivervoice · Terms · Privacy
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
