import { View } from "react-native";
import { router } from "expo-router";
import { Coins } from "lucide-react-native";
import * as DialogPrimitive from "@rn-primitives/dialog";
import {
  Dialog,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useThemeColors } from "@/lib/theme";

interface CreditsExhaustedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Shown wherever a call (or try-agent session) can't start, or gets cut
 * off, because the account is out of credits — see `FerryCallEvents.
 * onCreditsExhausted`. No close-X, same reasoning as `DeleteAlert`: "Not
 * now" is the only way out without acting. */
export function CreditsExhaustedDialog({
  open,
  onOpenChange,
}: CreditsExhaustedDialogProps) {
  const colors = useThemeColors();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <View
          className="absolute inset-0 justify-center px-6"
          pointerEvents="box-none"
        >
          <DialogOverlay />
          <DialogPrimitive.Content className="w-full rounded-xl border border-border bg-card p-5 shadow-lift">
            <View className="items-center gap-3 pt-1">
              <View className="h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
                <Coins
                  size={24}
                  strokeWidth={1.75}
                  color={colors.destructive}
                />
              </View>
              <View className="items-center gap-1">
                <DialogTitle>Out of credits</DialogTitle>
                <DialogDescription className="text-center">
                  You&apos;ve used up your credits. Recharge to keep making
                  calls.
                </DialogDescription>
              </View>
            </View>

            <View className="mt-5 w-full flex-row gap-2">
              <Button
                variant="ghost"
                size="lg"
                className="flex-1"
                onPress={() => onOpenChange(false)}
              >
                Not now
              </Button>
              <Button
                size="lg"
                className="flex-1"
                onPress={() => {
                  onOpenChange(false);
                  router.push("/recharge");
                }}
              >
                Recharge
              </Button>
            </View>
          </DialogPrimitive.Content>
        </View>
      </DialogPortal>
    </Dialog>
  );
}
