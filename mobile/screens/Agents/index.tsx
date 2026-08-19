import { useState } from "react";
import { View, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Plus, Search, X, ChevronRight, Bot } from "lucide-react-native";
import { Mascot } from "@/components/Mascot";
import { CallRow } from "@/components/CallRow";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { AGENTS } from "./mock";

export default function AgentsScreen() {
  const [search, setSearch] = useState("");

  const filtered = search
    ? AGENTS.filter(
        (agent) =>
          agent.name.toLowerCase().includes(search.toLowerCase()) ||
          agent.purpose.toLowerCase().includes(search.toLowerCase()),
      )
    : AGENTS;

  const liveCount = AGENTS.filter((agent) => agent.status === "live").length;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      {/* Header — fixed, the list scrolls beneath it */}
      <View className="flex-row items-start justify-between px-5 pt-3 pb-1">
        <View>
          <Text className="text-[28px] font-semibold tracking-[-0.02em]">
            Agents
          </Text>
          <Text variant="muted" className="mt-1 text-sm">
            {liveCount} answering now
          </Text>
        </View>
        <Button size="sm" onPress={() => router.push("/agent-new")}>
          <Plus size={14} strokeWidth={2} color="#fcfbf9" />
          <Text className="text-xs font-medium text-primary-foreground">
            New
          </Text>
        </Button>
      </View>

      {/* Search */}
      <View className="px-5 pt-2 pb-2">
        <View className="relative">
          {/* The icon sits in a view, not on the Svg itself: NativeWind
              cannot position lucide's Svg, so a className on the icon is
              silently ignored. The z-index keeps the input's background
              from painting over it. */}
          <View className="pointer-events-none absolute top-0 bottom-0 left-3 z-10 justify-center">
            <Search size={16} strokeWidth={1.75} color="#8f8c87" />
          </View>
          <Input
            className="pl-9 pr-9"
            placeholder="Find an agent"
            placeholderTextColor="#b0ada7"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <Pressable
              onPress={() => setSearch("")}
              hitSlop={8}
              className="absolute top-0 bottom-0 right-2 z-10 justify-center"
            >
              <X size={14} strokeWidth={1.75} color="#8f8c87" />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* List */}
        {filtered.length === 0 ? (
          <View className="items-center py-16">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-border">
              <Bot size={22} strokeWidth={1.75} color="#b0ada7" />
            </View>
            <Text variant="muted" className="mt-3 text-sm">
              {search ? "No agent matches your search" : "No agents yet"}
            </Text>
          </View>
        ) : (
          <View className="mt-2 px-5">
            <Card className="overflow-hidden">
              {filtered.map((agent, index) => (
                <CallRow
                  key={agent.id}
                  avatar={<Mascot seed={agent.name} size={32} />}
                  title={agent.name}
                  subtitle={`${agent.purpose} · ${agent.calls} calls`}
                  trailing={
                    <ChevronRight size={16} strokeWidth={1.75} color="#8f8c87" />
                  }
                  showDivider={index !== filtered.length - 1}
                  onPress={() =>
                    router.push({
                      pathname: "/agent-detail",
                      params: { id: agent.id },
                    })
                  }
                />
              ))}
            </Card>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
