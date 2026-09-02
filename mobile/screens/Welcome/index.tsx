import { useState } from "react";
import { View } from "react-native";
import { Waves } from "lucide-react-native";
import { Mascot } from "@/components/Mascot";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/hooks/use-auth";
import { useThemeColors } from "@/lib/theme";

export default function WelcomeScreen() {
  const colors = useThemeColors();
  const { continueWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleContinueWithGoogle() {
    setError("");
    setLoading(true);
    try {
      await continueWithGoogle();
    } catch (err) {
      console.error("continueWithGoogle failed:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="flex-1 bg-canvas px-6 pt-16 pb-10">
      {/* Top section - Logo and branding */}
      <View className="items-center">
        <View className="h-12 w-12 items-center justify-center rounded-2xl border border-border bg-card shadow-float">
          <Waves size={24} strokeWidth={2} color={colors.ink} />
        </View>
        <Text className="mt-4 text-[17px] font-semibold tracking-[-0.02em]">
          Rivervoice
        </Text>
        <Text variant="muted" className="mt-1 text-[13px]">
          Real-time voice translation
        </Text>
      </View>

      {/* Center illustration area */}
      <View className="mt-auto mb-auto items-center">
        <Mascot
          seed="Nikhil"
          style="notionists"
          size={160}
          params={{ glassesProbability: 100 }}
        />
        <Text className="mt-8 text-center text-[26px] font-semibold leading-tight tracking-[-0.02em]">
          AI translation,{"\n"}on every call
        </Text>
        <Text
          variant="muted"
          className="mt-4 max-w-xs text-center text-sm leading-6"
        >
          An AI agent answers in real time, translating any language into yours
          as the call happens.
        </Text>
      </View>

      {/* Bottom section - CTA */}
      <View className="gap-3">
        {error ? (
          <Text variant="destructive" className="text-center text-[13px]">
            {error}
          </Text>
        ) : null}
        <Button size="lg" onPress={handleContinueWithGoogle} loading={loading}>
          Continue with Google
        </Button>
      </View>
    </View>
  );
}
