import "../global.css";
import { useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PortalHost } from "@rn-primitives/portal";
import { SessionProvider } from "@/state/session";
import { Splash } from "@/components/Splash";

export default function RootLayout() {
  const [booted, setBooted] = useState(false);

  return (
    <SafeAreaProvider>
      <SessionProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="call-detail" />
          <Stack.Screen name="transcript" />
          <Stack.Screen name="agent-new" />
        </Stack>
        <PortalHost />
        <StatusBar style="dark" />
        {!booted && <Splash onDone={() => setBooted(true)} />}
      </SessionProvider>
    </SafeAreaProvider>
  );
}
