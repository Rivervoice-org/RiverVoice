import { Redirect, Slot } from "expo-router";
import { View } from "react-native";
import { useAuth } from "@/hooks/use-auth";

export default function AuthLayout() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <View className="flex-1 bg-canvas">
      <Slot />
    </View>
  );
}
