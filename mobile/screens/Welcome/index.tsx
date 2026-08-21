import { View } from "react-native";
import { router } from "expo-router";
import { Waves } from "lucide-react-native";
import { Mascot } from "@/components/Mascot";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/lib/theme";

export default function WelcomeScreen() {
  const colors = useThemeColors();
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
        <Mascot seed="welcome-agent" size={160} />
        <Text className="mt-8 text-center text-[26px] font-semibold leading-tight tracking-[-0.02em]">
          Your calls,{"\n"}answered by an AI agent{"\n"}in the caller's language
        </Text>
        <Text variant="muted" className="mt-4 max-w-xs text-center text-sm leading-6">
          5 languages, switched mid-call, on a line that picks up in one ring.
        </Text>
      </View>

      {/* Bottom section - CTA buttons */}
      <View className="gap-3">
        <Button size="lg" onPress={() => router.replace("/(tabs)")}>
          Get started
        </Button>

        <Button
          size="lg"
          variant="outline"
          onPress={() => router.push("/(auth)/sign-in")}
        >
          Login with number
        </Button>
      </View>
    </View>
  );
}
