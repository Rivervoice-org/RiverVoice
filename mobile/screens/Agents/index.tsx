import { useState } from "react";
import { View, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Plus, ChevronRight, Bot } from "lucide-react-native";
import { Mascot } from "@/components/Mascot";
import { CallRow } from "@/components/CallRow";
import { SearchInput } from "@/components/SearchInput";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Rise, rowDelay } from "@/components/ui/rise";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/lib/theme";
import { useAgents } from "@/lib/agents/hooks";

export default function AgentsScreen() {
  const colors = useThemeColors();
  const [search, setSearch] = useState("");
  const { data: agents, isPending, isError } = useAgents();

  const filtered = (agents ?? []).filter(
    (agent) =>
      !search || agent.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      {/* Header — fixed, the list scrolls beneath it */}
      <Rise index={0}>
        <View className="flex-row items-start justify-between px-5 pt-3 pb-1">
          <View>
            <Text className="text-[28px] font-semibold tracking-[-0.02em]">
              Agents
            </Text>
          </View>
          <Button size="sm" onPress={() => router.push("/agent-new")}>
            <Plus size={14} strokeWidth={2} color={colors.onInk} />
            <Text className="text-xs font-medium text-primary-foreground">
              New
            </Text>
          </Button>
        </View>
      </Rise>

      {/* Search */}
      <Rise index={1}>
        <View className="px-5 pt-2 pb-2">
          <SearchInput
            value={search}
            onChangeText={setSearch}
            placeholder="Find an agent"
          />
        </View>
      </Rise>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* List */}
        {isPending ? (
          <View className="items-center py-16">
            <ActivityIndicator color={colors.muted} />
          </View>
        ) : isError ? (
          <Rise index={2}>
            <View className="items-center py-16">
              <View className="h-12 w-12 items-center justify-center rounded-full bg-border">
                <Bot size={22} strokeWidth={1.75} color={colors.faint} />
              </View>
              <Text variant="muted" className="mt-3 text-sm">
                Couldn&apos;t load your agents
              </Text>
            </View>
          </Rise>
        ) : filtered.length === 0 ? (
          <Rise index={2}>
            <View className="items-center py-16">
              <Mascot size={48} />
              <Text variant="muted" className="mt-3 text-sm">
                {search ? "No agent matches your search" : "No agents yet"}
              </Text>
            </View>
          </Rise>
        ) : (
          <View className="mt-2 px-5">
            <Card className="overflow-hidden">
              {filtered.map((agent, index) => (
                <Rise key={agent.id} delay={rowDelay(2, index)}>
                  <CallRow
                    avatar={
                      <Mascot
                        ref={agent.mascot ?? undefined}
                        seed={agent.name}
                        size={32}
                      />
                    }
                    title={agent.name}
                    subtitle={`${agent.inputLanguage.toUpperCase()} → ${agent.outputLanguage.toUpperCase()}`}
                    trailing={
                      <ChevronRight
                        size={16}
                        strokeWidth={1.75}
                        color={colors.muted}
                      />
                    }
                    showDivider={index !== filtered.length - 1}
                    onPress={() =>
                      router.push({
                        pathname: "/agent-detail",
                        params: { id: agent.id },
                      })
                    }
                  />
                </Rise>
              ))}
            </Card>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
