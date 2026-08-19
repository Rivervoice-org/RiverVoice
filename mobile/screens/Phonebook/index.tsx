import { View, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronRight, Phone, Plus } from "lucide-react-native";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { NUMBERS, type PhoneNumber } from "./mock";

function StatusBadge({ status }: { status: PhoneNumber["status"] }) {
  const live = status === "live";
  return (
    <Badge variant={live ? "green" : "secondary"} className="gap-1 px-2 py-0.5">
      <View
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          live ? "bg-green" : "bg-muted-foreground"
        )}
      />
      <Text
        className={cn(
          "text-[11px] font-medium",
          live ? "text-green" : "text-muted-foreground"
        )}
      >
        {live ? "Active" : "Paused"}
      </Text>
    </Badge>
  );
}

export default function PhonebookScreen() {
  const liveCount = NUMBERS.filter((n) => n.status === "live").length;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-start justify-between px-5 pt-3 pb-1">
        <View>
          <Text className="text-[28px] font-semibold tracking-[-0.02em]">
            My numbers
          </Text>
          <Text variant="muted" className="mt-1 text-sm">
            {liveCount} active · {NUMBERS.length - liveCount} paused
          </Text>
        </View>
        <Button size="sm" onPress={() => router.push("/number-new")}>
          <Plus size={14} strokeWidth={2} color="#fcfbf9" />
          <Text className="text-xs font-medium text-primary-foreground">
            Add
          </Text>
        </Button>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="mt-4 gap-3 px-5">
          {NUMBERS.map((number) => {
            const live = number.status === "live";
            return (
              <Pressable
                key={number.id}
                onPress={() => {}}
                className="active:opacity-80"
              >
                <Card className="p-4">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2">
                      <View
                        className={cn(
                          "h-7 w-7 items-center justify-center rounded-lg",
                          live ? "bg-river-tint" : "bg-secondary"
                        )}
                      >
                        <Phone
                          size={13}
                          strokeWidth={1.75}
                          color={live ? "#3b5dab" : "#8f8c87"}
                        />
                      </View>
                      <Text className="text-[15px] font-medium">
                        {number.label}
                      </Text>
                    </View>
                    <StatusBadge status={number.status} />
                  </View>

                  <Text
                    font="mono"
                    className="mt-3 text-[24px] font-semibold tracking-[-0.02em]"
                    adjustsFontSizeToFit
                    numberOfLines={1}
                  >
                    {number.number}
                  </Text>

                  <View className="mt-3 flex-row items-center justify-between">
                    <View className="flex-row items-center gap-1.5">
                      <Badge variant="outline" className="px-2 py-0">
                        <Text className="text-[11px] font-medium text-muted-foreground">
                          {number.kind}
                        </Text>
                      </Badge>
                      <Text variant="muted" className="text-[12px]">
                        via {number.provider}
                      </Text>
                    </View>
                    <ChevronRight size={16} strokeWidth={1.75} color="#8f8c87" />
                  </View>
                </Card>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
