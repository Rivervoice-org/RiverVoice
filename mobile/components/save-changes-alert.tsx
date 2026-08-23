import { View } from "react-native";
import { Save } from "lucide-react-native";
import * as DialogPrimitive from "@rn-primitives/dialog";
import {
  Dialog,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useThemeColors } from "@/lib/theme";

interface SaveChangesAlertProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What needs saving first, e.g. "Save your changes before trying the agent." */
  description: string;
  title?: string;
}

/** App-wide "you need to save first" nudge — any action that depends on a
 * persisted, up-to-date record (e.g. Try agent) should use this instead of
 * silently saving on its behalf or rolling its own dialog. Same Dialog
 * primitives as `@/components/DeleteAlert`, swapped to an amber informational
 * tint instead of destructive red, with a single acknowledge action since
 * there's only one way forward — go save it. */
export function SaveChangesAlert({
  open,
  onOpenChange,
  description,
  title = "Save changes first",
}: SaveChangesAlertProps) {
  const colors = useThemeColors();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <View
          className="absolute inset-0 justify-center px-6"
          pointerEvents="box-none"
        >
          <DialogOverlay />
          <DialogPrimitive.Content
            className={cn(
              "w-full rounded-xl border border-border bg-card p-5 shadow-lift",
            )}
          >
            <View className="items-center gap-3 pt-1">
              <View className="h-14 w-14 items-center justify-center rounded-full bg-amber/10">
                <Save size={24} strokeWidth={1.75} color={colors.amber} />
              </View>
              <View className="items-center gap-1">
                <DialogTitle>{title}</DialogTitle>
                <DialogDescription className="text-center">
                  {description}
                </DialogDescription>
              </View>
            </View>

            <View className="mt-5 w-full">
              <Button size="lg" onPress={() => onOpenChange(false)}>
                Got it
              </Button>
            </View>
          </DialogPrimitive.Content>
        </View>
      </DialogPortal>
    </Dialog>
  );
}
