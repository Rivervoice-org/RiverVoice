import { Redirect, Stack, usePathname } from "expo-router";
import { View } from "react-native";
import { useAuth } from "@/hooks/use-auth";
import { useOnboardingSeen } from "@/lib/onboarding";
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
  const seenOnboarding = useOnboardingSeen();
  const pathname = usePathname();

  // Restoring a session from the stored refresh token is asynchronous, and
  // isAuthenticated is false until it finishes. Redirecting during that
  // window would bounce a genuinely signed-in user out to Welcome on every
  // cold start, so hold on a blank canvas until the answer is real.
  if (isBootstrapping || seenOnboarding === null) {
    return <View className="flex-1 bg-canvas" />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)" />;
  }

  // First run after signing in: send a new user through the tour before
  // anything else. Guarded on pathname so the redirect doesn't fire again
  // once we're already there — it would otherwise loop instead of letting
  // the Stack below ever mount the onboarding screen itself.
  if (!seenOnboarding && pathname !== "/onboarding") {
    return <Redirect href="/onboarding" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.canvas },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="call-detail" />
      <Stack.Screen name="credits-history" />
      <Stack.Screen name="recharge" />
      <Stack.Screen name="transcript" />
      <Stack.Screen name="agent-detail" />
      <Stack.Screen name="agent-new" />
      <Stack.Screen name="in-call" />
      <Stack.Screen name="try-agent" />
    </Stack>
  );
}
