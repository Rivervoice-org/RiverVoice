import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { Waves } from "lucide-react-native";

export default function WelcomeScreen() {
  return (
    <View className="flex-1 bg-canvas px-6 pt-16 pb-10">
      {/* Top section - Logo and branding */}
      <View className="items-center">
        <View className="h-12 w-12 items-center justify-center rounded-2xl border border-border bg-card shadow-float">
          <Waves size={24} strokeWidth={2} color="#3c3832" />
        </View>
        <Text className="mt-4 text-[17px] font-semibold tracking-[-0.02em] text-foreground">
          Rivervoice
        </Text>
        <Text className="mt-1 text-[13px] text-muted-foreground">
          Real-time voice translation
        </Text>
      </View>

      {/* Center illustration area */}
      <View className="mt-auto mb-auto items-center">
        <View className="h-40 w-40 items-center justify-center rounded-full bg-muted">
          <Waves size={64} strokeWidth={1.5} color="#3c3832" />
        </View>
        <Text className="mt-8 text-center text-[26px] font-semibold leading-tight tracking-[-0.02em] text-foreground">
          Your agent answers{"\n"}in whichever language{"\n"}the phone rings in.
        </Text>
        <Text className="mt-4 max-w-xs text-center text-sm leading-6 text-muted-foreground">
          23 languages, switched mid-call, on a line that picks up in one ring.
        </Text>
      </View>

      {/* Bottom section - CTA buttons */}
      <View className="gap-3">
        <Pressable
          onPress={() => router.replace("/(tabs)")}
          className="h-12 flex-row items-center justify-center rounded-xl bg-foreground shadow-float"
        >
          <Text className="text-sm font-medium text-primary-foreground">
            Get started
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/(auth)/sign-in")}
          className="h-12 flex-row items-center justify-center rounded-xl border border-border bg-card"
        >
          <Text className="text-sm font-medium text-foreground">
            I already have an account
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
