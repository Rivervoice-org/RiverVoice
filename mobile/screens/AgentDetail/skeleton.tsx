import { View } from "react-native";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const SETTING_ROW_WIDTHS = ["w-1/3", "w-2/5", "w-1/4", "w-1/3"] as const;

/**
 * The screen's own shape, held empty: hero card, section label, four
 * settings rows.
 *
 * The cards and their borders are real and only their contents are
 * placeholder — skeletoning whole cards leaves grey slabs floating in the
 * gaps between them, which reads as a broken page rather than a loading
 * one. The header is drawn by the screen, not here, so the back button
 * stays live while this is on screen.
 */
export function AgentDetailSkeleton() {
  return (
    <>
      <Card className="mx-5 items-center p-6">
        <Skeleton className="h-16 w-16 rounded-full" />
        <Skeleton className="mt-3 h-5 w-2/5 rounded-full" />
        <Skeleton className="mt-2.5 h-3.5 w-1/2 rounded-full" />
      </Card>

      <View className="mt-8">
        <Skeleton className="mx-5 h-2.5 w-24 rounded-full" />
        <Card className="mx-5 mt-3 overflow-hidden">
          {SETTING_ROW_WIDTHS.map((width, index) => (
            <View
              key={width + index}
              className={cn(
                "flex-row items-center justify-between px-4 py-3",
                index < SETTING_ROW_WIDTHS.length - 1 &&
                  "border-b border-border",
              )}
            >
              <Skeleton className={cn("h-3 rounded-full", width)} />
              <Skeleton className="h-3 w-16 rounded-full" />
            </View>
          ))}
        </Card>
      </View>
    </>
  );
}
