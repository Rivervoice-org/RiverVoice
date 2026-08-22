import { View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronRight, Phone, Plus } from "lucide-react-native";
import { CallRow } from "@/components/CallRow";
import { SignInPrompt } from "@/components/SignInPrompt";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Rise, rowDelay } from "@/components/ui/rise";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { useThemeColors } from "@/lib/theme";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { NUMBERS, type PhoneNumber } from "./mock";

function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      variant="muted"
      className="px-5 text-[11px] font-medium uppercase tracking-[0.14em]"
    >
      {children}
    </Text>
  );
}

/**
 * A row per number, table-style: a phone icon on the left and the number
 * itself as the title, since that's what this screen is a directory of.
 */
function NumberGroup({
  title,
  numbers,
  className,
}: {
  title?: string;
  numbers: PhoneNumber[];
  className?: string;
}) {
  const colors = useThemeColors();
  if (numbers.length === 0) return null;

  return (
    <View className={className}>
      {title ? <SectionLabel>{`${title} · ${numbers.length}`}</SectionLabel> : null}
      <Card className={cn("mx-5 overflow-hidden", title && "mt-2.5")}>
        {numbers.map((number, index) => (
          <Rise key={number.id} delay={rowDelay(1, index)}>
            <CallRow
              avatar={
                <View className="h-8 w-8 items-center justify-center rounded-lg bg-secondary">
                  <Phone size={14} strokeWidth={1.75} color={colors.muted} />
                </View>
              }
              mono
              title={number.number}
              subtitle={`${number.label} · ${number.kind} · ${number.provider}`}
              trailing={<ChevronRight size={16} strokeWidth={1.75} color={colors.muted} />}
              showDivider={index < numbers.length - 1}
              onPress={() =>
                router.push({
                  pathname: "/number-detail",
                  params: { id: number.id },
                })
              }
            />
          </Rise>
        ))}
      </Card>
    </View>
  );
}

export default function PhonebookScreen() {
  const colors = useThemeColors();
  const { requireAuth, isAuthenticated } = useRequireAuth();
  const numbers = NUMBERS.filter((n) => !n.assignedAgent);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      {/* Header */}
      <Rise index={0}>
        <View className="flex-row items-start justify-between px-5 pt-3 pb-1">
          <View>
            <Text className="text-[28px] font-semibold tracking-[-0.02em]">
              My numbers
            </Text>
            {isAuthenticated ? (
              <Text variant="muted" className="mt-1 text-sm">
                {numbers.length} number{numbers.length === 1 ? "" : "s"}
              </Text>
            ) : null}
          </View>
          <Button size="sm" onPress={() => requireAuth(() => router.push("/number-new"))}>
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
              icon={<Phone size={22} strokeWidth={1.75} color={colors.faint} />}
              message="Sign in to see your numbers"
            />
          </Rise>
        ) : (
          <NumberGroup numbers={numbers} className="mt-4" />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
