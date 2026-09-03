import { useEffect, useState } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { router } from "expo-router";
import { Phone, PhoneOutgoing, X } from "lucide-react-native";
import * as DialogPrimitive from "@rn-primitives/dialog";
import { Mascot } from "@/components/Mascot";
import { Button } from "@/components/ui/button";
import { Dialog, DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import { Text } from "@/components/ui/text";
import { PulseRing } from "@/motion/pulse-ring";
import { useAgents } from "@/lib/agents/hooks";
import { consumeJustSignedIn } from "@/lib/create-agent-prompt";
import { useThemeColors } from "@/lib/theme";

/** The agent, front and center, bridging a call between its two ends. */
function TranslateBridgeIllustration() {
  const colors = useThemeColors();
  const drift = useSharedValue(0);

  useEffect(() => {
    drift.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900 }),
        withTiming(-1, { duration: 900 }),
      ),
      -1,
      true,
    );
  }, [drift]);

  const lineStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: drift.value * 10 }],
  }));

  return (
    <View className="h-32 w-full items-center justify-center">
      <View className="items-center justify-center">
        <PulseRing size={36} color={colors.ink} duration={2200} />
        <View className="absolute h-16 w-16 items-center justify-center rounded-full border border-border bg-card shadow-float">
          <Mascot seed="new-agent" size={44} />
        </View>
      </View>

      <View className="mt-4 flex-row items-center gap-3">
        <View className="h-8 w-8 items-center justify-center rounded-full bg-border">
          <PhoneOutgoing size={14} strokeWidth={1.75} color={colors.muted} />
        </View>
        <Animated.View style={lineStyle} className="h-px w-8 bg-border" />
        <View className="h-8 w-8 items-center justify-center rounded-full bg-border">
          <Phone size={14} strokeWidth={1.75} color={colors.muted} />
        </View>
      </View>
    </View>
  );
}

/**
 * A big floating panel nudging the user to create an agent. Rendered
 * through the Dialog portal (same one every other modal in the app uses)
 * so it's centered on the whole screen regardless of where it's mounted,
 * not just within whatever box its parent happens to be.
 */
export function CreateAgentPrompt() {
  const colors = useThemeColors();
  // Captured once, at mount — true only when this Home mount is the one
  // right after a sign-in, never on a later revisit of the tab.
  const [justSignedIn] = useState(consumeJustSignedIn);
  const [dismissed, setDismissed] = useState(false);
  const { data: agents, isPending } = useAgents();

  const open = justSignedIn && !dismissed && !isPending && agents?.length === 0;

  function close() {
    setDismissed(true);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogPortal>
        <View
          className="absolute inset-0 items-center justify-center px-6"
          pointerEvents="box-none"
        >
          <DialogOverlay />
          <DialogPrimitive.Content className="w-full max-w-sm items-center rounded-3xl border border-border bg-card px-6 pt-10 pb-6 shadow-lift">
            <DialogPrimitive.Close
              onPress={close}
              className="absolute top-3 right-3 h-8 w-8 items-center justify-center rounded-full bg-secondary active:opacity-70"
              hitSlop={8}
            >
              <X size={14} strokeWidth={2} color={colors.muted} />
            </DialogPrimitive.Close>

            <TranslateBridgeIllustration />

            <Text className="mt-2 text-center text-[22px] font-semibold leading-tight tracking-[-0.02em]">
              Meet your AI agents
            </Text>
            <Text
              variant="muted"
              className="mt-3 text-center text-sm leading-6"
            >
              Assign an agent when you call, and it translates in real time — in
              the language, tone, and voice you pick.
            </Text>

            <Button
              size="lg"
              className="mt-6 w-full"
              onPress={() => {
                close();
                router.push("/agent-new");
              }}
            >
              Create an agent
            </Button>
          </DialogPrimitive.Content>
        </View>
      </DialogPortal>
    </Dialog>
  );
}
