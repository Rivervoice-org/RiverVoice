import { View } from "react-native";
import { router } from "expo-router";
import { Mascot } from "@/components/Mascot";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Text } from "@/components/ui/text";

interface SignInRequiredDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when the user chooses to proceed to sign-in, before navigating —
   * lets the provider know to keep the deferred action instead of dropping it. */
  onConfirm: () => void;
}

/** Presentational only — SignInPromptProvider owns when this opens. */
export function SignInRequiredDialog({ open, onOpenChange, onConfirm }: SignInRequiredDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <View className="items-center gap-3 pt-1">
          <Mascot seed="sign-in-required" size={64} />
          <View className="items-center gap-1">
            <DialogTitle>Sign in required</DialogTitle>
            <DialogDescription className="text-center">
              Create an account or sign in with your number to do that.
            </DialogDescription>
          </View>
        </View>

        <View className="mt-5 w-full gap-2">
          <Button
            size="lg"
            onPress={() => {
              onConfirm();
              onOpenChange(false);
              router.push("/(auth)/continue-with-number");
            }}
          >
            <Text className="text-sm font-medium text-primary-foreground">
              Continue with number
            </Text>
          </Button>
          <Button variant="ghost" size="lg" onPress={() => onOpenChange(false)}>
            <Text className="text-sm font-medium text-foreground">Not now</Text>
          </Button>
        </View>
      </DialogContent>
    </Dialog>
  );
}
