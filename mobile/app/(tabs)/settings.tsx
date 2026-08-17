import { View, Text, Pressable } from "react-native";
import { LogOut } from "lucide-react-native";
import { useAuth } from "../../lib/auth-context";

export default function SettingsScreen() {
  const { signOut } = useAuth();

  return (
    <View className="flex-1 items-center justify-center bg-canvas px-6">
      <Text className="text-display-sm text-foreground">Settings</Text>
      <Text className="mt-2 text-body text-muted-foreground">
        App preferences and account settings.
      </Text>

      <Pressable
        onPress={signOut}
        className="mt-10 flex-row items-center gap-2 rounded-xl border border-border bg-card px-5 py-3 shadow-float"
      >
        <LogOut size={16} strokeWidth={1.75} color="#c4384c" />
        <Text className="text-sm font-medium text-destructive">Sign out</Text>
      </Pressable>
    </View>
  );
}
