import { useState } from "react";
import { View } from "react-native";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

interface SignInPromptProps {
  /** Icon element, e.g. `<Bot size={22} strokeWidth={1.75} color={colors.faint} />` */
  icon: React.ReactNode;
  message: string;
}

/** Empty-state shown in place of a screen's content when signed out. */
export function SignInPrompt({ icon, message }: SignInPromptProps) {
  const { continueWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);

  async function handlePress() {
    setLoading(true);
    try {
      await continueWithGoogle();
    } catch (err) {
      // Nowhere in this empty state to surface an error — the button just
      // stops loading and the user can tap it again.
      console.error("continueWithGoogle failed:", err);
    } finally {
      setLoading(false);
    }
  }

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
        onPress={handlePress}
        loading={loading}
      >
        <Text className="text-xs font-medium text-foreground">
          Continue with Google
        </Text>
      </Button>
    </View>
  );
}
