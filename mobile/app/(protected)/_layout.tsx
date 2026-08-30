import { Redirect, Stack } from "expo-router";
import { View } from "react-native";
import { useAuth } from "@/hooks/use-auth";
import { useThemeColors } from "@/lib/theme";

/**
 * The signed-in half of the app. Every route under here is unreachable
 * without a session, so the screens themselves never branch on auth — they
 * can assume a user exists, and `Redirect` is the single place that decides
 * otherwise.
 */
export default function ProtectedLayout() {
  const colors = useThemeColors();
  const { isAuthenticated, isBootstrapping } = useAuth();

  // Restoring a session from the stored refresh token is asynchronous, and
  // isAuthenticated is false until it finishes. Redirecting during that
  // window would bounce a genuinely signed-in user out to Welcome on every
  // cold start, so hold on a blank canvas until the answer is real.
  if (isBootstrapping) {
    return <View className="flex-1 bg-canvas" />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.canvas },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="call-detail" />
      <Stack.Screen name="transcript" />
      <Stack.Screen name="agent-detail" />
      <Stack.Screen name="agent-new" />
      <Stack.Screen name="in-call" />
      <Stack.Screen name="try-agent" />
    </Stack>
  );
}
