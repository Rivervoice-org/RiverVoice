import { View } from "react-native";
import { Trash2 } from "lucide-react-native";
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

interface DeleteAlertProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What's being deleted, e.g. `Delete "${agent.name}"? This can't be undone.` */
  description: string;
  title?: string;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
}

/** App-wide delete confirmation — any screen with a destructive delete
 * action should use this instead of rolling its own dialog. Uses the same
 * Dialog primitives as `@/components/ui/dialog`, but without its built-in
 * close-X — the Cancel button is the only way to dismiss without deleting. */
export function DeleteAlert({
  open,
  onOpenChange,
  description,
  title = "Delete",
  confirmLabel = "Delete",
  loading,
  onConfirm,
}: DeleteAlertProps) {
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
              <View className="h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
                <Trash2
                  size={24}
                  strokeWidth={1.75}
                  color={colors.destructive}
                />
              </View>
              <View className="items-center gap-1">
                <DialogTitle>{title}</DialogTitle>
                <DialogDescription className="text-center">
                  {description}
                </DialogDescription>
              </View>
            </View>

            <View className="mt-5 w-full flex-row gap-2">
              <Button
                variant="ghost"
                size="lg"
                className="flex-1"
                disabled={loading}
                onPress={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="lg"
                className="flex-1"
                loading={loading}
                onPress={onConfirm}
              >
                {confirmLabel}
              </Button>
            </View>
          </DialogPrimitive.Content>
        </View>
      </DialogPortal>
    </Dialog>
  );
}
