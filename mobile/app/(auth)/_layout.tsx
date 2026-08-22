import { Redirect, Slot } from "expo-router";
import { View } from "react-native";
import { useAuth } from "@/hooks/use-auth";

export default function AuthLayout() {
  const { isAuthenticated, isBootstrapping } = useAuth();

  // Don't decide Welcome-vs-redirect until we know whether a stored
  // refresh token actually restores a session — otherwise a genuinely
  // signed-in user flashes Welcome on every cold start before bootstrap
  // finishes and flips isAuthenticated to true.
  if (isBootstrapping) {
    return <View className="flex-1 bg-canvas" />;
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <View className="flex-1 bg-canvas">
      <Slot />
    </View>
  );
}
