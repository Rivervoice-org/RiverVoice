import { View } from "react-native";
import { Text } from "@/components/ui/text";

export default function AgentsScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-canvas px-6">
      <Text className="text-display-sm">Agents</Text>
      <Text variant="muted" className="mt-2 text-body">
        Manage your voice agents.
      </Text>
    </View>
  );
}
