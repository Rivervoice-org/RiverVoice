import { Alert } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/hooks/use-auth";

/** Guards an action behind a session; prompts to sign in when there is none. */
export function useRequireAuth() {
  const { isAuthenticated } = useAuth();

  function requireAuth(action: () => void) {
    if (isAuthenticated) {
      action();
    } else {
      Alert.alert(
        "Sign in required",
        "Create an account or sign in to use this feature.",
        [
          { text: "Not now", style: "cancel" },
          {
            text: "Sign in",
            onPress: () => router.push("/(auth)/continue-with-number"),
          },
        ]
      );
    }
  }

  return { requireAuth, isAuthenticated };
}
