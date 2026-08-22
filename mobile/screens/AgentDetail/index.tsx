import { useState } from "react";
import { View, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Pencil, Trash2 } from "lucide-react-native";
import { Mascot } from "@/components/Mascot";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DeleteAlert } from "@/components/delete-alert";
import { Rise } from "@/components/ui/rise";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/lib/theme";
import { deleteAgent } from "@/lib/agents/api";
import { agentsQueryKey, useAgents } from "@/lib/agents/hooks";

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  te: "Telugu",
  ta: "Tamil",
  kn: "Kannada",
};

const MODE_LABELS: Record<string, string> = {
  formal: "Formal",
  "modern-colloquial": "Modern Colloquial",
  "classic-colloquial": "Classic Colloquial",
  "code-mixed": "Code Mixed",
};

const GENDER_LABELS: Record<string, string> = {
  female: "Female",
  male: "Male",
  neutral: "Neutral",
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between px-4 py-3">
      <Text variant="muted" className="text-sm">
        {label}
      </Text>
      <Text className="text-sm font-medium">{value}</Text>
    </View>
  );
}

export default function AgentDetailScreen() {
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: agents, isPending } = useAgents();
  const agent = agents?.find((a) => a.id === id);
  const queryClient = useQueryClient();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: deleteAgent,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: agentsQueryKey });
      router.back();
    },
  });

  if (isPending) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center bg-canvas"
        edges={["top"]}
      >
        <ActivityIndicator color={colors.muted} />
      </SafeAreaView>
    );
  }

  if (!agent) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center bg-canvas"
        edges={["top"]}
      >
        <Text variant="muted">Agent not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          className="h-9 w-9 items-center justify-center rounded-lg active:bg-secondary"
          hitSlop={8}
        >
          <ChevronLeft size={22} strokeWidth={1.75} color={colors.ink} />
        </Pressable>
        <Text className="flex-1 text-center text-[17px] font-semibold">
          Agent
        </Text>
        <Pressable
          onPress={() =>
            router.push({ pathname: "/agent-new", params: { id: agent.id } })
          }
          className="h-9 w-9 items-center justify-center rounded-lg active:bg-secondary"
          hitSlop={8}
        >
          <Pencil size={18} strokeWidth={1.75} color={colors.ink} />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero card */}
        <Rise index={0}>
          <Card className="mx-5 items-center p-6">
            <View className="h-16 w-16 overflow-hidden rounded-full bg-secondary">
              <Mascot
                ref={agent.mascot ?? undefined}
                seed={agent.name}
                size={64}
              />
            </View>

            <Text className="mt-3 text-[20px] font-semibold">{agent.name}</Text>
            <Text variant="muted" className="mt-1 text-center text-sm">
              {LANGUAGE_LABELS[agent.input_language] ?? agent.input_language} →{" "}
              {LANGUAGE_LABELS[agent.output_language] ?? agent.output_language}
            </Text>
          </Card>
        </Rise>

        {/* Settings */}
        <View className="mt-8">
          <Rise index={1}>
            <View className="px-5">
              <Text
                variant="muted"
                className="text-[11px] font-medium uppercase tracking-[0.14em]"
              >
                Settings
              </Text>
            </View>
          </Rise>

          <Card className="mx-5 mt-3 divide-y divide-border overflow-hidden">
            <InfoRow
              label="Input language"
              value={
                LANGUAGE_LABELS[agent.input_language] ?? agent.input_language
              }
            />
            <InfoRow
              label="Output language"
              value={
                LANGUAGE_LABELS[agent.output_language] ?? agent.output_language
              }
            />
            {agent.mode ? (
              <InfoRow
                label="Mode"
                value={MODE_LABELS[agent.mode] ?? agent.mode}
              />
            ) : null}
            {agent.gender ? (
              <InfoRow
                label="Voice gender"
                value={GENDER_LABELS[agent.gender] ?? agent.gender}
              />
            ) : null}
          </Card>
        </View>

        <Rise index={2}>
          <View className="items-center pt-8">
            <Button
              variant="outline"
              className="px-5"
              loading={deleteMutation.isPending}
              onPress={() => setConfirmingDelete(true)}
            >
              <Trash2 size={16} strokeWidth={1.75} color={colors.destructive} />
              <Text variant="destructive" className="text-sm font-medium">
                Delete agent
              </Text>
            </Button>
            {deleteMutation.isError ? (
              <Text
                variant="destructive"
                className="mt-2 text-center text-[13px]"
              >
                {deleteMutation.error instanceof Error
                  ? deleteMutation.error.message
                  : "Couldn't delete agent. Please try again."}
              </Text>
            ) : null}
          </View>
        </Rise>
      </ScrollView>

      <DeleteAlert
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title="Delete agent"
        description={`Delete "${agent.name}"? This can't be undone.`}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(agent.id)}
      />
    </SafeAreaView>
  );
}
