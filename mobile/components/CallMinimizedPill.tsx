import { memo } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, usePathname } from "expo-router";
import { Phone } from "lucide-react-native";
import { Mascot } from "@/components/Mascot";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/lib/theme";
import { useActiveCall } from "@/hooks/use-active-call";
import { inCallRouteParams } from "@/state/active-call/context";
import { callStatusLabel, useElapsedSeconds } from "@/lib/call-status";

/**
 * Floats above every screen once a call is active and the user has
 * navigated away from `/in-call` — tapping it returns to that screen with
 * the same params it was launched with, reconstructed from `meta` since the
 * screen itself may not be mounted right now. The call keeps running in
 * `ActiveCallProvider` regardless of whether this is on screen; this is
 * purely "how do I get back to looking at it."
 */
export const CallMinimizedPill = memo(function CallMinimizedPill() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { meta, status, connectedAt } = useActiveCall();
  const duration = useElapsedSeconds(connectedAt);

  if (!meta || pathname === "/in-call") {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-x-0 z-50 items-center"
      style={{ top: insets.top + 8 }}
    >
      <Pressable
        onPress={() =>
          router.push({
            pathname: "/in-call",
            params: inCallRouteParams(meta),
          })
        }
        className="flex-row items-center gap-2 rounded-full bg-foreground py-2 pl-2 pr-4 shadow-float active:opacity-90"
      >
        <Mascot
          ref={meta.agentMascot || undefined}
          seed={meta.agentName}
          size={22}
        />
        <Phone size={13} strokeWidth={2} color={colors.onInk} />
        <Text className="text-[13px] font-medium text-primary-foreground">
          {callStatusLabel(status, duration)}
        </Text>
      </Pressable>
    </View>
  );
});
