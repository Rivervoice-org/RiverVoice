import { useState } from "react";
import { View } from "react-native";
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
  continueWithGoogle: () => Promise<void>;
  /** Called once continueWithGoogle actually succeeds, so the provider can
   * run whatever action was deferred behind this prompt. */
  onSignedIn: () => void;
}

/** Presentational only — SignInPromptProvider owns when this opens. */
export function SignInRequiredDialog({
  open,
  onOpenChange,
  continueWithGoogle,
  onSignedIn,
}: SignInRequiredDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleContinueWithGoogle() {
    setError("");
    setLoading(true);
    try {
      await continueWithGoogle();
      onSignedIn();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <View className="items-center gap-3 pt-1">
          <Mascot seed="sign-in-required" size={64} />
          <View className="items-center gap-1">
            <DialogTitle>Sign in required</DialogTitle>
            <DialogDescription className="text-center">
              Continue with Google to do that.
            </DialogDescription>
          </View>
        </View>

        {error ? (
          <Text variant="destructive" className="mt-3 text-center text-[13px]">
            {error}
          </Text>
        ) : null}

        <View className="mt-5 w-full gap-2">
          <Button size="lg" onPress={handleContinueWithGoogle} loading={loading}>
            <Text className="text-sm font-medium text-primary-foreground">
              Continue with Google
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
