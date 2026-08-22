import { useCallback, useEffect, useRef } from "react";
import { View, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { router } from "expo-router";
import { Bot } from "lucide-react-native";
import { Mascot } from "@/components/Mascot";
import { CallRow } from "@/components/CallRow";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/lib/theme";
import { useAgents } from "@/lib/agents/hooks";
import type { AgentResponse } from "@/lib/agents/types";

/**
 * Same visible/onClose contract as DialPadSheet — mounted once by
 * AgentPickerProvider and driven by `pickAgentForCall`, rather than owning
 * its own open state.
 */
export function AgentPickerSheet({
  visible,
  onSelect,
  onClose,
}: {
  visible: boolean;
  onSelect: (agent: AgentResponse) => void;
  onClose: () => void;
}) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheetModal>(null);
  const { data: agents, isPending, isError } = useAgents();
  // A sheet's first-ever mount gets torn down by React StrictMode's dev-only
  // double-invoked effects — @gorhom/bottom-sheet's internal Portal fires its
  // real onDismiss as part of that simulated unmount, closing the sheet
  // immediately after present(), before the user could have dismissed it.
  // Track "we just asked it to open" so that spurious dismiss can be told
  // apart from a real one and recovered from, instead of dropping the sheet.
  const justPresentedRef = useRef(false);

  useEffect(() => {
    if (visible) {
      justPresentedRef.current = true;
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [visible]);

  const handleChange = useCallback((index: number) => {
    if (index >= 0) justPresentedRef.current = false;
  }, []);

  const handleDismiss = useCallback(() => {
    if (justPresentedRef.current) {
      justPresentedRef.current = false;
      // Deferred: this fires from inside React's own StrictMode double-invoke
      // commit pass, so re-presenting synchronously here would reenter React
      // mid-commit, before providers above (e.g. ThemeProvider) are fully
      // restored — letting content rendered by the re-present crash on
      // missing context. Let that commit finish first.
      setTimeout(() => sheetRef.current?.present(), 0);
      return;
    }
    onClose();
  }, [onClose]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.25}
        pressBehavior="close"
      />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      onChange={handleChange}
      onDismiss={handleDismiss}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.canvas }}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
    >
      <BottomSheetView style={{ paddingBottom: insets.bottom + 14 }} className="px-5 pt-1">
        <Text className="mb-3 text-base font-semibold">Call with</Text>

        {isPending ? (
          <View className="items-center py-10">
            <ActivityIndicator color={colors.muted} />
          </View>
        ) : isError ? (
          <View className="items-center py-10">
            <Text variant="muted" className="text-sm">
              Couldn't load your agents
            </Text>
          </View>
        ) : !agents || agents.length === 0 ? (
          <View className="items-center py-10">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-border">
              <Bot size={22} strokeWidth={1.75} color={colors.faint} />
            </View>
            <Text variant="muted" className="mt-3 text-sm">
              No agents yet
            </Text>
            <Button
              size="sm"
              className="mt-4"
              onPress={() => {
                onClose();
                router.push("/agent-new");
              }}
            >
              <Text className="text-xs font-medium text-primary-foreground">
                Create an agent
              </Text>
            </Button>
          </View>
        ) : (
          <Card className="overflow-hidden">
            {agents.map((agent, index) => (
              <CallRow
                key={agent.id}
                avatar={<Mascot ref={agent.mascot ?? undefined} seed={agent.name} size={32} />}
                title={agent.name}
                subtitle={`${agent.input_language.toUpperCase()} → ${agent.output_language.toUpperCase()}`}
                showDivider={index !== agents.length - 1}
                onPress={() => onSelect(agent)}
              />
            ))}
          </Card>
        )}
      </BottomSheetView>
    </BottomSheetModal>
  );
}
