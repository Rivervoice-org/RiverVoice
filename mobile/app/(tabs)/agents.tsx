import { View, Text } from "react-native";

export default function AgentsScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-canvas px-6">
      <Text className="text-display-sm text-foreground">Agents</Text>
      <Text className="mt-2 text-body text-muted-foreground">
        Manage your voice agents.
      </Text>
    </View>
  );
}
