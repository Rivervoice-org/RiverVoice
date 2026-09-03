import "../global.css";
import { StrictMode, useEffect, useState } from "react";
import { LogBox } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PortalHost } from "@rn-primitives/portal";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { SessionProvider } from "@/state/session";
import { AgentPickerProvider } from "@/providers/agent-picker-provider";
import { ActiveCallProvider } from "@/providers/active-call-provider";
import { ContactsProvider } from "@/state/contacts";
import { Splash } from "@/components/Splash";
import { ThemeProvider, useTheme } from "@/lib/theme";

// @gorhom/bottom-sheet (already on its latest release, 5.2.14) still uses a
// legacy ref-resolution path internally for its gesture/portal handling,
// which React 19's StrictMode logs as a deprecation error on teardown (e.g.
// closing a screen that has a BottomSheetModal mounted, like InCall's
// captions sheet). It's benign — nothing actually breaks — but LogBox
// surfaces it as a full-screen error. Suppressed until upstream updates;
// revisit when bumping @gorhom/bottom-sheet past 5.2.14.
LogBox.ignoreLogs(["is deprecated in StrictMode"]);

function AppShell({
  booted,
  onBooted,
}: {
  booted: boolean;
  onBooted: () => void;
}) {
  const { scheme, colors } = useTheme();

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.canvas);
  }, [colors.canvas]);

  return (
    <SessionProvider>
      <AgentPickerProvider>
        <ContactsProvider>
          <ActiveCallProvider>
            {/* Two halves, and the only two: `(auth)` is what a signed-out
                  user can reach, `(protected)` is everything else. The split
                  is the app's whole authorization story — no screen below
                  repeats it. */}
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.canvas },
              }}
            >
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(protected)" />
            </Stack>
            <PortalHost />
            <StatusBar style={scheme === "dark" ? "light" : "dark"} />
            {!booted && <Splash onDone={onBooted} />}
          </ActiveCallProvider>
        </ContactsProvider>
      </AgentPickerProvider>
    </SessionProvider>
  );
}

export default function RootLayout() {
  const [booted, setBooted] = useState(false);

  return (
    <StrictMode>
      {/* gesture-handler needs this at the root. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider>
              {/*
                @gorhom/bottom-sheet renders every BottomSheetModal's content
                through an internal Portal, whose host is a *sibling* of
                whatever BottomSheetModalProvider wraps (see PortalProvider in
                @gorhom/portal) — not a descendant of it. Nesting it here,
                innermost, means that sibling host still inherits SafeArea/
                QueryClient/Theme context; nesting it further out (as it used
                to be) left sheet content unable to reach ThemeProvider at all.
              */}
              <BottomSheetModalProvider>
                <AppShell booted={booted} onBooted={() => setBooted(true)} />
              </BottomSheetModalProvider>
            </ThemeProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </StrictMode>
  );
}
