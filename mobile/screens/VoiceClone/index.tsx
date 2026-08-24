import { View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronRight, Mic, Plus } from "lucide-react-native";
import { CallRow } from "@/components/CallRow";
import { SignInPrompt } from "@/components/SignInPrompt";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Rise, rowDelay } from "@/components/ui/rise";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/lib/theme";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { VOICE_CLONES } from "./mock";

export default function VoiceCloneScreen() {
  const colors = useThemeColors();
  const { requireAuth, isAuthenticated } = useRequireAuth();
  const clones = VOICE_CLONES;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      {/* Header */}
      <Rise index={0}>
        <View className="flex-row items-start justify-between px-5 pt-3 pb-1">
          <View>
            <Text className="text-[28px] font-semibold tracking-[-0.02em]">
              Voice clone
            </Text>
            {isAuthenticated ? (
              <Text variant="muted" className="mt-1 text-sm">
                {clones.length} clone{clones.length === 1 ? "" : "s"}
              </Text>
            ) : null}
          </View>
          <Button size="sm" onPress={() => requireAuth(() => router.push("/voice-clone-new"))}>
            <Plus size={14} strokeWidth={2} color={colors.onInk} />
            <Text className="text-xs font-medium text-primary-foreground">
              Add
            </Text>
          </Button>
        </View>
      </Rise>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {!isAuthenticated ? (
          <Rise index={1}>
            <SignInPrompt
              icon={<Mic size={22} strokeWidth={1.75} color={colors.faint} />}
              message="Sign in to see your voice clones"
            />
          </Rise>
        ) : clones.length === 0 ? (
          <Rise index={1}>
            <View className="mx-5 mt-4 items-center rounded-xl border border-dashed border-border py-10">
              <Mic size={20} strokeWidth={1.75} color={colors.faint} />
              <Text variant="muted" className="mt-2 text-xs">
                No voice clones yet
              </Text>
            </View>
          </Rise>
        ) : (
          <Card className="mx-5 mt-4 overflow-hidden">
            {clones.map((clone, index) => (
              <Rise key={clone.id} delay={rowDelay(1, index)}>
                <CallRow
                  avatar={
                    <View className="h-8 w-8 items-center justify-center rounded-lg bg-secondary">
                      <Mic size={14} strokeWidth={1.75} color={colors.muted} />
                    </View>
                  }
                  title={clone.name}
                  subtitle={`${clone.duration} sample`}
                  trailing={
                    clone.status === "processing" ? (
                      <Badge variant="amber">Processing</Badge>
                    ) : (
                      <ChevronRight size={16} strokeWidth={1.75} color={colors.muted} />
                    )
                  }
                  showDivider={index < clones.length - 1}
                />
              </Rise>
            ))}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
