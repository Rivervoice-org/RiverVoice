import { View } from "react-native";
import { router } from "expo-router";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

interface SignInPromptProps {
  /** Icon element, e.g. `<Bot size={22} strokeWidth={1.75} color={colors.faint} />` */
  icon: React.ReactNode;
  message: string;
}

/** Empty-state shown in place of a screen's content when signed out. */
export function SignInPrompt({ icon, message }: SignInPromptProps) {
  return (
    <View className="items-center py-16">
      <View className="h-12 w-12 items-center justify-center rounded-full bg-border">
        {icon}
      </View>
      <Text variant="muted" className="mt-3 text-sm">
        {message}
      </Text>
      <Button
        size="sm"
        variant="outline"
        className="mt-4"
        onPress={() => router.push("/(auth)/continue-with-number")}
      >
        <Text className="text-xs font-medium text-foreground">
          Continue with number
        </Text>
      </Button>
    </View>
  );
}
