import { useState } from "react";
import { View, Pressable, ScrollView } from "react-native";
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
import {
  agentsQueryKey,
  recentAgentsQueryKey,
  useAgent,
} from "@/lib/agents/hooks";
import { AgentDetailSkeleton } from "./skeleton";

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
  // Fetched by id, not found in the agents list: arriving from Home's
  // recently-used rows there is no list in cache to search, and those rows
  // carry only a name and a mascot.
  const { data: agent, isPending, isError } = useAgent(id);
  const queryClient = useQueryClient();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: deleteAgent,
    onSuccess: async () => {
      // Both lists carried this agent, and the recent one is the section a
      // user lands back on.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: agentsQueryKey }),
        queryClient.invalidateQueries({ queryKey: recentAgentsQueryKey }),
      ]);
      router.back();
    },
  });

  if (isPending) {
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
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
          <View className="w-9" />
        </View>

        <AgentDetailSkeleton />
      </SafeAreaView>
    );
  }

  if (isError || !agent) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center bg-canvas px-5"
        edges={["top"]}
      >
        <Mascot seed={id ?? "unknown"} size={64} />
        <Text className="mt-4 text-lg font-semibold">Agent not found</Text>
        <Text variant="muted" className="mt-1.5 text-center text-sm leading-relaxed">
          This agent may have been deleted or the link is incorrect.
        </Text>
        <Button
          variant="outline"
          size="sm"
          className="mt-5"
          onPress={() => router.back()}
        >
          <Text className="text-xs font-medium text-foreground">Go back</Text>
        </Button>
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
              {LANGUAGE_LABELS[agent.inputLanguage] ?? agent.inputLanguage} →{" "}
              {LANGUAGE_LABELS[agent.outputLanguage] ?? agent.outputLanguage}
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
                LANGUAGE_LABELS[agent.inputLanguage] ?? agent.inputLanguage
              }
            />
            <InfoRow
              label="Output language"
              value={
                LANGUAGE_LABELS[agent.outputLanguage] ?? agent.outputLanguage
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
