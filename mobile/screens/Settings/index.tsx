import { View } from "react-native";
import { LogOut } from "lucide-react-native";
import { useAuth } from "@/state/session";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

export default function SettingsScreen() {
  const { signOut } = useAuth();

  return (
    <View className="flex-1 items-center justify-center bg-canvas px-6">
      <Text className="text-display-sm">Settings</Text>
      <Text variant="muted" className="mt-2 text-body">
        App preferences and account settings.
      </Text>

      <Button
        variant="outline"
        onPress={signOut}
        className="mt-10 px-5"
      >
        <LogOut size={16} strokeWidth={1.75} color="#c4384c" />
        <Text variant="destructive" className="text-sm font-medium">
          Sign out
        </Text>
      </Button>
    </View>
  );
}
