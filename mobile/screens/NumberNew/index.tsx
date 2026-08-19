import { View, Pressable, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useForm, useStore } from "@tanstack/react-form";
import { ChevronLeft, Phone } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { NUMBERS } from "@/screens/Phonebook/mock";

const KINDS = [
  { value: "Main line", label: "Main line" },
  { value: "Toll-free", label: "Toll-free" },
  { value: "Mobile", label: "Mobile" },
  { value: "Local", label: "Local" },
];

const PROVIDERS = [
  { value: "Twilio", label: "Twilio" },
  { value: "Exotel", label: "Exotel" },
  { value: "Telnyx", label: "Telnyx" },
  { value: "Vobiz", label: "Vobiz" },
  { value: "Plivo", label: "Plivo" },
];

type NumberValues = {
  number: string;
  kind: string | null;
  provider: string | null;
};

const DEFAULT_VALUES: NumberValues = {
  number: "",
  kind: null,
  provider: null,
};

function SectionLabel({ children }: { children: string }) {
  return (
    <Text variant="muted" className="text-[11px] font-medium uppercase tracking-[0.14em]">
      {children}
    </Text>
  );
}

function ChipGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T | null) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(selected ? null : option.value)}
            className={cn(
              "rounded-full border px-3.5 py-2 active:opacity-80",
              selected ? "border-foreground bg-foreground" : "border-border bg-card"
            )}
          >
            <Text
              className={cn(
                "text-[13px] font-medium",
                selected ? "text-primary-foreground" : "text-foreground"
              )}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function NumberNewScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editingNumber = id ? NUMBERS.find((n) => n.id === id) : undefined;
  const isEditing = !!editingNumber;

  const form = useForm({
    defaultValues: editingNumber
      ? {
          number: editingNumber.number,
          kind: editingNumber.kind,
          provider: editingNumber.provider,
        }
      : DEFAULT_VALUES,
    validators: {
      onChange: ({ value }) => {
        if (!value.number.trim()) return "Enter a phone number";
        if (!value.kind) return "Pick a number type";
        if (!value.provider) return "Pick a provider";
        return undefined;
      },
    },
    onSubmit: async ({ value }) => {
      // Mock: a real create/update call lands here once the API exists.
      await new Promise((r) => setTimeout(r, 800));
      router.back();
    },
  });

  const values = useStore(form.store, (state) => state.values);
  const canSubmit = useStore(form.store, (state) => state.canSubmit);
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          className="h-9 w-9 items-center justify-center rounded-lg active:bg-secondary"
          hitSlop={8}
        >
          <ChevronLeft size={22} strokeWidth={1.75} color="#2e2a25" />
        </Pressable>
        <Text className="flex-1 text-center text-[17px] font-semibold">
          {isEditing ? "Edit number" : "New number"}
        </Text>
        <View className="w-9" />
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Icon + number block, mirrors the AgentNew profile block */}
          <View className="items-center pt-4 pb-8">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-secondary">
              <Phone size={26} strokeWidth={1.75} color="#3c3832" />
            </View>
            <Input
              className="mt-4 h-12 border-0 bg-transparent px-0 text-center font-mono text-[22px] font-semibold"
              placeholder="+1 415 555 0100"
              placeholderTextColor="#b0ada7"
              value={values.number}
              onChangeText={(text) => form.setFieldValue("number", text)}
              keyboardType="phone-pad"
            />
            <Text variant="muted" className="mt-1 text-[13px]">
              Enter the number as it should be dialed
            </Text>
          </View>

          {/* Settings */}
          <View className="gap-7">
            <View className="gap-2.5">
              <SectionLabel>Type</SectionLabel>
              <ChipGroup
                options={KINDS}
                value={values.kind}
                onChange={(v) => form.setFieldValue("kind", v)}
              />
            </View>

            <View className="gap-2.5">
              <SectionLabel>Provider</SectionLabel>
              <ChipGroup
                options={PROVIDERS}
                value={values.provider}
                onChange={(v) => form.setFieldValue("provider", v)}
              />
            </View>
          </View>
        </ScrollView>

        {/* Footer — padded past the home indicator */}
        <View
          className="border-t border-border bg-canvas px-5 pt-3"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          <Button
            size="lg"
            disabled={!canSubmit}
            loading={isSubmitting}
            onPress={() => form.handleSubmit()}
          >
            <Text className="text-sm font-medium text-primary-foreground">
              {isEditing ? "Save changes" : "Add number"}
            </Text>
          </Button>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
