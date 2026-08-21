import "../global.css";
import { StrictMode, useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PortalHost } from "@rn-primitives/portal";
import { SessionProvider } from "@/state/session";
import { ContactsProvider } from "@/state/contacts";
import { Splash } from "@/components/Splash";
import { ThemeProvider, useTheme } from "@/lib/theme";

function AppShell({ booted, onBooted }: { booted: boolean; onBooted: () => void }) {
  const { scheme, colors } = useTheme();

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.canvas);
  }, [colors.canvas]);

  return (
    <SessionProvider>
      <ContactsProvider>
        <Stack
          screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}
        >
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="call-detail" />
          <Stack.Screen name="transcript" />
          <Stack.Screen name="agent-new" />
          <Stack.Screen name="in-call" />
        </Stack>
        <PortalHost />
        <StatusBar style={scheme === "dark" ? "light" : "dark"} />
        {!booted && <Splash onDone={onBooted} />}
      </ContactsProvider>
    </SessionProvider>
  );
}

export default function RootLayout() {
  const [booted, setBooted] = useState(false);

  return (
    <StrictMode>
      {/* @gorhom/bottom-sheet (and gesture-handler generally) needs this at the root. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <BottomSheetModalProvider>
          <SafeAreaProvider>
            <ThemeProvider>
              <AppShell booted={booted} onBooted={() => setBooted(true)} />
            </ThemeProvider>
          </SafeAreaProvider>
        </BottomSheetModalProvider>
      </GestureHandlerRootView>
    </StrictMode>
  );
}
