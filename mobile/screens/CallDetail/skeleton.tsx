import { View, ScrollView } from "react-native";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * The screen's own layout, held empty.
 *
 * The chrome is real — the cards, their borders, their padding — and only
 * the content inside them is placeholder. Skeletoning whole cards instead
 * leaves big grey slabs floating in the gaps between them, which reads as
 * a broken page rather than a loading one.
 */
export function CallDetailSkeleton() {
  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero: avatar, name, number, agent line, outcome badge, meta row. */}
      <Card className="mx-5 items-center p-6">
        <Skeleton className="h-16 w-16 rounded-full" />
        <Skeleton className="mt-3 h-5 w-2/5 rounded-full" />
        <Skeleton className="mt-2 h-3.5 w-1/3 rounded-full" />
        <Skeleton className="mt-2.5 h-3 w-2/5 rounded-full" />
        <Skeleton className="mt-4 h-6 w-24 rounded-full" />
        <Skeleton className="mt-4 h-3 w-1/2 rounded-full" />
      </Card>

      {/* Stat grid, four of `StatCard`'s anatomy. */}
      <View className="mx-5 mt-4 flex-row flex-wrap gap-3">
        {["w-3/5", "w-1/2", "w-2/3", "w-1/2"].map((valueWidth, index) => (
          <Card key={index} className="w-[47.5%] p-3">
            <Skeleton className="h-7 w-7 rounded-lg" />
            <Skeleton className="mt-2.5 h-2.5 w-3/4 rounded-full" />
            <Skeleton className={cn("mt-2 h-4 rounded-full", valueWidth)} />
            <Skeleton className="mt-2 h-2.5 w-4/5 rounded-full" />
          </Card>
        ))}
      </View>

      {/* Recording card: icon, heading, one line of body. */}
      <Card className="mx-5 mt-6 p-4">
        <View className="flex-row items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-3 w-24 rounded-full" />
        </View>
        <Skeleton className="mt-3 h-2.5 w-2/5 rounded-full" />
      </Card>

      {/* Transcription row, which is a bordered row rather than a card. */}
      <View className="mx-5 mt-6 flex-row items-center justify-between rounded-xl border border-border bg-card px-4 py-3.5">
        <View className="flex-row items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-3 w-32 rounded-full" />
        </View>
        <View className="flex-row items-center gap-2">
          <Skeleton className="h-2.5 w-12 rounded-full" />
          <Skeleton className="h-4 w-4 rounded" />
        </View>
      </View>

      {/* Call button. Solid by nature, so it stays a solid block. */}
      <Skeleton className="mx-5 mt-8 h-12 rounded-lg" />
    </ScrollView>
  );
}
