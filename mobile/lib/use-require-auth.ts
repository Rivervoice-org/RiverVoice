import { Alert } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/state/session";

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
            onPress: () => router.push("/(auth)/sign-in"),
          },
        ]
      );
    }
  }

  return { requireAuth, isAuthenticated };
}
