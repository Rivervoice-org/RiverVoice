import { useState } from "react";
import { View, Pressable, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useForm, useStore } from "@tanstack/react-form";
import { ChevronLeft, Mic, Square } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/lib/theme";
import { cn } from "@/lib/utils";

const SAMPLE_SCRIPT =
  "Read this out loud in your own voice: “The quick brown fox jumps over the lazy dog, and the river runs quietly past the old mill.”";

type VoiceCloneValues = {
  name: string;
};

export default function VoiceCloneNewScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [isRecording, setIsRecording] = useState(false);
  const [hasSample, setHasSample] = useState(false);

  const form = useForm({
    defaultValues: { name: "" } as VoiceCloneValues,
    validators: {
      onChange: ({ value }) => {
        if (!value.name.trim()) return "Give this clone a name";
        if (!hasSample) return "Record a voice sample";
        return undefined;
      },
    },
    onSubmit: async () => {
      // Mock: a real upload/clone call lands here once the API exists.
      await new Promise((r) => setTimeout(r, 800));
      router.back();
    },
  });

  const values = useStore(form.store, (state) => state.values);
  const canSubmit = useStore(form.store, (state) => state.canSubmit);
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      setHasSample(true);
    } else {
      setHasSample(false);
      setIsRecording(true);
    }
  };

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
          New voice clone
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
          <View className="items-center pt-4 pb-8">
            <Pressable
              onPress={toggleRecording}
              className={cn(
                "h-20 w-20 items-center justify-center rounded-full active:opacity-80",
                isRecording ? "bg-destructive" : "bg-foreground"
              )}
            >
              {isRecording ? (
                <Square size={24} strokeWidth={2} color={colors.onInk} fill={colors.onInk} />
              ) : (
                <Mic size={26} strokeWidth={1.75} color={colors.onInk} />
              )}
            </Pressable>
            <Text variant="muted" className="mt-3 text-[13px]">
              {isRecording ? "Recording… tap to stop" : hasSample ? "Sample captured" : "Tap to record a sample"}
            </Text>
          </View>

          <View className="gap-7">
            <View className="gap-2.5 rounded-xl border border-border bg-card p-4">
              <Text variant="muted" className="text-[11px] font-medium uppercase tracking-[0.14em]">
                Script
              </Text>
              <Text className="text-sm leading-5">{SAMPLE_SCRIPT}</Text>
            </View>

            <View className="gap-2.5">
              <Text variant="muted" className="text-[11px] font-medium uppercase tracking-[0.14em]">
                Name
              </Text>
              <Input
                placeholder="e.g. My voice"
                placeholderTextColor={colors.faint}
                value={values.name}
                onChangeText={(text) => form.setFieldValue("name", text)}
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
              Create clone
            </Text>
          </Button>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
