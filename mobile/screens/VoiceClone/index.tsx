import { View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Mic } from "lucide-react-native";
import { Rise } from "@/components/ui/rise";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/lib/theme";

export default function VoiceCloneScreen() {
  const colors = useThemeColors();

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <Rise index={0}>
        <View className="px-5 pt-3 pb-1">
          <Text className="text-[28px] font-semibold tracking-[-0.02em]">
            Voice clone
          </Text>
        </View>
      </Rise>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <Rise index={1}>
          <View className="items-center py-16">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-border">
              <Mic size={22} strokeWidth={1.75} color={colors.faint} />
            </View>
            <Text variant="muted" className="mt-3 text-sm">
              Coming soon
            </Text>
          </View>
        </Rise>
      </ScrollView>
    </SafeAreaView>
  );
}
