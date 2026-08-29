import { useEffect, useRef, useState } from "react";
import {
  View,
  Pressable,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useForm, useStore } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import { ChevronLeft, Check, PhoneCall, Play, Pause } from "lucide-react-native";
import { MascotPicker } from "@/components/MascotPicker";
import { SaveChangesAlert } from "@/components/save-changes-alert";
import { DEFAULT_MASCOT_REF } from "@/lib/mascots";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { useThemeColors } from "@/lib/theme";
import { createAgent, updateAgent, previewVoice } from "@/lib/agents/api";
import { agentsQueryKey, useAgents } from "@/lib/agents/hooks";
import type {
  AgentResponse,
  Gender,
  Language,
  Mode,
  UpdateAgentRequest,
} from "@/lib/agents/types";

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "te", label: "Telugu" },
  { value: "ta", label: "Tamil" },
  { value: "kn", label: "Kannada" },
];

const MODES = [
  {
    value: "formal",
    label: "Formal",
    description: "Polished, formal wording",
  },
  {
    value: "modern-colloquial",
    label: "Modern Colloquial",
    description: "Everyday conversational tone",
  },
  {
    value: "classic-colloquial",
    label: "Classic Colloquial",
    description: "Traditional, literary phrasing",
  },
  {
    value: "code-mixed",
    label: "Code Mixed",
    description: "Blends English with the target language",
  },
];

const GENDERS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "neutral", label: "Neutral" },
];

/**
 * A curated subset of Sarvam's bulbul:v3 voice names
 * (https://docs.sarvam.ai — Text to Speech), keyed by the same values as
 * GENDERS. The female/male voices here match Sarvam's documented gender for
 * each (see ferry's BulbulV3Voice::gender, which the create/update agent
 * endpoints validate against) — Sarvam has no neutral voices at all, so the
 * "neutral" group is just a curated pick from the full list, and ferry
 * doesn't enforce a gender match for it.
 */
const VOICES_BY_GENDER: Record<string, string[]> = {
  female: ["priya", "neha", "pooja", "kavya", "shreya", "ishita"],
  male: ["shubh", "aditya", "rahul", "rohan", "amit", "dev"],
  neutral: ["ratan", "varun", "sumit", "roopa", "mani"],
};

type AgentValues = {
  name: string;
  inputLang: string | null;
  outputLang: string | null;
  mode: string | null;
  gender: string | null;
  mascot: string | undefined;
  voice: string | null;
};

const DEFAULT_VALUES: AgentValues = {
  name: "",
  inputLang: null,
  outputLang: null,
  mode: null,
  gender: null,
  // Matches MascotPicker's own fallback face — the picker shows this by
  // default regardless, so the form should already consider it "picked"
  // rather than silently blocking submission until the user reopens the
  // same picker just to choose what's already on screen.
  mascot: DEFAULT_MASCOT_REF,
  voice: null,
};

function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      variant="muted"
      className="text-[11px] font-medium uppercase tracking-[0.14em]"
    >
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
              selected
                ? "border-foreground bg-foreground"
                : "border-border bg-card",
            )}
          >
            <Text
              className={cn(
                "text-[13px] font-medium",
                selected ? "text-primary-foreground" : "text-foreground",
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

function ModeList({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const colors = useThemeColors();
  return (
    <View className="gap-2">
      {MODES.map((mode) => {
        const selected = mode.value === value;
        return (
          <Pressable
            key={mode.value}
            onPress={() => onChange(selected ? null : mode.value)}
            className={cn(
              "flex-row items-center gap-3 rounded-xl border bg-card px-3.5 py-3 active:opacity-80",
              selected ? "border-foreground" : "border-border",
            )}
          >
            <View className="min-w-0 flex-1">
              <Text className="text-sm font-medium">{mode.label}</Text>
              <Text variant="muted" className="mt-0.5 text-[13px]">
                {mode.description}
              </Text>
            </View>
            {selected && <Check size={16} strokeWidth={2} color={colors.ink} />}
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Voices for the currently-picked "Voice gender" only — picking a voice
 * before a gender doesn't make sense, and showing all three groups at once
 * just makes the list longer without helping the choice.
 */
function VoiceGroupPicker({
  gender,
  value,
  onChange,
  onPreview,
  previewingVoice,
  playingVoice,
}: {
  gender: string | null;
  value: string | null;
  onChange: (value: string | null) => void;
  onPreview: (voice: string) => void;
  previewingVoice: string | null;
  playingVoice: string | null;
}) {
  const colors = useThemeColors();

  if (!gender) {
    return (
      <View className="rounded-xl border border-border bg-card px-3.5 py-3">
        <Text variant="muted" className="text-[13px]">
          Pick a voice gender above to see voices
        </Text>
      </View>
    );
  }

  const voices = VOICES_BY_GENDER[gender] ?? [];

  return (
    <View className="gap-2">
      {voices.map((voice) => {
        const selected = voice === value;
        const isLoadingPreview = previewingVoice === voice;
        const isPlayingPreview = playingVoice === voice;
        return (
          <Pressable
            key={voice}
            onPress={() => onChange(selected ? null : voice)}
            className={cn(
              "flex-row items-center gap-3 rounded-xl border bg-card px-3.5 py-3 active:opacity-80",
              selected ? "border-foreground" : "border-border",
            )}
          >
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onPreview(voice);
              }}
              disabled={isLoadingPreview}
              hitSlop={8}
              className="h-8 w-8 items-center justify-center rounded-full bg-secondary active:opacity-70"
            >
              {isLoadingPreview ? (
                <ActivityIndicator size="small" color={colors.ink} />
              ) : isPlayingPreview ? (
                <Pause size={14} strokeWidth={1.75} color={colors.ink} fill={colors.ink} />
              ) : (
                <Play size={14} strokeWidth={1.75} color={colors.ink} fill={colors.ink} />
              )}
            </Pressable>
            <Text className="flex-1 text-sm font-medium capitalize">{voice}</Text>
            {selected && <Check size={16} strokeWidth={2} color={colors.ink} />}
          </Pressable>
        );
      })}
    </View>
  );
}

export default function AgentNewScreen() {
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data: agents, isPending } = useAgents();

  // Editing an existing agent depends on data useForm only reads once, at
  // mount — defaultValues isn't reactive, so mounting the form before the
  // agents query resolves would freeze it on DEFAULT_VALUES even after the
  // real data arrives. An unrecognized id would also silently fall through
  // to the create path instead of erroring. Gate on the query settling
  // before mounting AgentForm at all, so it's only ever constructed once
  // with the right editingAgent already known.
  if (id && isPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas" edges={["top"]}>
        <ActivityIndicator color={colors.muted} />
      </SafeAreaView>
    );
  }

  const editingAgent = id ? agents?.find((a) => a.id === id) : undefined;

  if (id && !editingAgent) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas" edges={["top"]}>
        <Text variant="muted">Agent not found</Text>
      </SafeAreaView>
    );
  }

  return <AgentForm editingAgent={editingAgent} />;
}

/** Every field is required before the form can submit. */
function isFormComplete(value: AgentValues): boolean {
  return !!(
    value.name.trim() &&
    value.inputLang &&
    value.outputLang &&
    value.mode &&
    value.gender &&
    value.mascot &&
    value.voice
  );
}

/** Only the fields that actually changed vs. `editingAgent` — omitted keys
 * leave that column untouched server-side (see UpdateAgentRequest on
 * ferry). Shared by the Save button and the Try-agent save-first flow so
 * they can't drift on what counts as "changed". */
function buildPatch(value: AgentValues, editingAgent: AgentResponse): UpdateAgentRequest {
  const patch: UpdateAgentRequest = {};
  if (value.name.trim() !== editingAgent.name) {
    patch.name = value.name.trim();
  }
  if (value.inputLang !== editingAgent.inputLanguage) {
    patch.inputLanguage = value.inputLang as Language;
  }
  if (value.outputLang !== editingAgent.outputLanguage) {
    patch.outputLanguage = value.outputLang as Language;
  }
  if (value.mode && value.mode !== editingAgent.mode) {
    patch.mode = value.mode as Mode;
  }
  if (value.gender && value.gender !== editingAgent.gender) {
    patch.gender = value.gender as Gender;
  }
  if (value.mascot && value.mascot !== editingAgent.mascot) {
    patch.mascot = value.mascot;
  }
  if (value.voice && value.voice !== editingAgent.voice) {
    patch.voice = value.voice;
  }
  return patch;
}

/** Isolated so its `state.values` subscription (needed for `hasChanges`)
 * only re-renders the footer, not the whole screen — every other field
 * above subscribes narrowly via `form.Field`/`form.Subscribe`. */
function FormFooter({
  form,
  editingAgent,
  isEditing,
  isSaving,
  error,
  colors,
  insets,
  handleTryAgent,
}: {
  // useForm's return type carries a large generic signature driven by its
  // validators; re-declaring it here isn't worth the noise, so this one
  // prop is untyped and everything used off it (store/Field/Subscribe/
  // handleSubmit) is checked instead where `form` is actually constructed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any;
  editingAgent: AgentResponse | undefined;
  isEditing: boolean;
  isSaving: boolean;
  error: string;
  colors: ReturnType<typeof useThemeColors>;
  insets: ReturnType<typeof useSafeAreaInsets>;
  handleTryAgent: () => void;
}) {
  const values: AgentValues = useStore(form.store, (state: { values: AgentValues }) => state.values);
  const canSubmit: boolean = useStore(form.store, (state: { canSubmit: boolean }) => state.canSubmit);
  const isSubmitting: boolean = useStore(form.store, (state: { isSubmitting: boolean }) => state.isSubmitting);

  // Editing an agent with no actual changes has nothing to save — Save
  // changes should be disabled, not fire a no-op PATCH. New agents have no
  // "unchanged" state to compare against, so this only applies once editing.
  const hasChanges = !isEditing || (editingAgent && Object.keys(buildPatch(values, editingAgent)).length > 0);

  return (
    <View
      className="gap-2 border-t border-border bg-canvas px-5 pt-3"
      style={{ paddingBottom: insets.bottom + 12 }}
    >
      {error ? (
        <Text variant="destructive" className="text-center text-[13px]">
          {error}
        </Text>
      ) : null}
      <View className="flex-row gap-3">
        <Button
          variant="outline"
          size="lg"
          className="flex-1"
          disabled={isSaving}
          onPress={handleTryAgent}
        >
          <PhoneCall size={16} strokeWidth={1.75} color={colors.ink} />
          <Text className="text-sm font-medium text-foreground">
            Try agent
          </Text>
        </Button>
        <Button
          size="lg"
          className="flex-1"
          disabled={!canSubmit || !hasChanges || isSaving}
          loading={isSubmitting}
          onPress={() => form.handleSubmit()}
        >
          <Text className="text-sm font-medium text-primary-foreground">
            {isEditing ? "Save changes" : "Create agent"}
          </Text>
        </Button>
      </View>
    </View>
  );
}

function AgentForm({ editingAgent }: { editingAgent: AgentResponse | undefined }) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const isEditing = !!editingAgent;
  const [error, setError] = useState("");
  const [showSaveFirst, setShowSaveFirst] = useState(false);
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const previewPlayerRef = useRef<AudioPlayer | null>(null);
  // Guards Save/Create against double-submission from a fast double-tap —
  // a ref is checked/set synchronously, unlike state, so the second tap
  // sees it immediately rather than one render late. `isSaving` just
  // mirrors it for the `disabled` prop below. Try-agent no longer writes
  // anything itself (see handleTryAgent), so it doesn't need this guard.
  const savingRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    return () => {
      previewPlayerRef.current?.release();
    };
  }, []);

  async function handlePreviewVoice(voice: string) {
    if (previewingVoice) return;
    // Tapping the currently-playing voice again stops it, rather than
    // re-fetching and layering a second playback on top.
    if (playingVoice === voice) {
      previewPlayerRef.current?.release();
      previewPlayerRef.current = null;
      setPlayingVoice(null);
      return;
    }
    setPreviewingVoice(voice);
    try {
      const { audioBase64 } = await previewVoice(voice);
      previewPlayerRef.current?.release();
      const player = createAudioPlayer(`data:audio/wav;base64,${audioBase64}`);
      previewPlayerRef.current = player;
      player.addListener("playbackStatusUpdate", (status) => {
        if (status.didJustFinish) {
          setPlayingVoice((current) => (current === voice ? null : current));
        }
      });
      player.play();
      setPlayingVoice(voice);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't play that voice. Please try again.");
    } finally {
      setPreviewingVoice(null);
    }
  }

  const form = useForm({
    defaultValues: editingAgent
      ? {
          name: editingAgent.name,
          inputLang: editingAgent.inputLanguage,
          outputLang: editingAgent.outputLanguage,
          mode: editingAgent.mode,
          gender: editingAgent.gender,
          mascot: editingAgent.mascot ?? undefined,
          voice: editingAgent.voice,
        }
      : DEFAULT_VALUES,
    validators: {
      // The message text is never shown anywhere — canSubmit only cares
      // whether this returns undefined or not — so this just gates on
      // every required field being picked, checked on mount and on every
      // change since a field can go from picked back to empty.
      onMount: ({ value }) => (isFormComplete(value) ? undefined : "Incomplete"),
      onChange: ({ value }) => (isFormComplete(value) ? undefined : "Incomplete"),
    },
    onSubmit: async ({ value }) => {
      if (savingRef.current) return;
      savingRef.current = true;
      setIsSaving(true);
      setError("");
      try {
        if (isEditing && editingAgent) {
          const patch = buildPatch(value, editingAgent);

          if (Object.keys(patch).length === 0) {
            router.back();
            return;
          }

          await updateAgent(editingAgent.id, patch);
          await queryClient.invalidateQueries({ queryKey: agentsQueryKey });
          router.back();
          return;
        }
        // Guaranteed non-null by the form's onMount/onChange validators,
        // which block canSubmit (and thus this handler) until every one of
        // these is picked — see CreateAgentRequest's required fields.
        await createAgent({
          name: value.name.trim(),
          inputLanguage: value.inputLang as Language,
          outputLanguage: value.outputLang as Language,
          mode: value.mode as Mode,
          gender: value.gender as Gender,
          mascot: value.mascot as string,
          voice: value.voice as string,
        });
        await queryClient.invalidateQueries({ queryKey: agentsQueryKey });
        router.back();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      } finally {
        savingRef.current = false;
        setIsSaving(false);
      }
    },
  });

  // The try-agent call requires a real, persisted, up-to-date agent (ferry
  // looks it up server-side for languages/mode/gender/voice) — rather than
  // silently saving a draft/edit on your behalf (surprising on an
  // accidental tap, see SaveChangesAlert below), this only ever navigates
  // using an agent that's already saved with no pending edits. A brand-new
  // agent has no id at all yet, and an edited one might have changes that
  // were never explicitly saved — both cases just prompt to go save first.
  function handleTryAgent() {
    // Read the form's current values directly rather than subscribing —
    // this only runs on tap, so there's no render to keep in sync.
    const currentValues = form.store.state.values as AgentValues;
    const hasChanges =
      !isEditing || (editingAgent && Object.keys(buildPatch(currentValues, editingAgent)).length > 0);
    if (!isEditing || !editingAgent || hasChanges) {
      setShowSaveFirst(true);
      return;
    }
    router.push({
      pathname: "/try-agent",
      params: { id: editingAgent.id, name: editingAgent.name, mascot: editingAgent.mascot },
    });
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
          {isEditing ? "Edit agent" : "New agent"}
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
          {/* Profile block */}
          <View className="items-center pt-4 pb-8">
            <form.Field name="mascot">
              {(field) => (
                <MascotPicker
                  value={field.state.value}
                  onSelect={(ref) => field.handleChange(ref)}
                />
              )}
            </form.Field>
            <form.Field name="name">
              {(field) => (
                <Input
                  className="mt-4 h-12 min-w-[140px] max-w-full border-0 bg-transparent px-0 text-center text-[22px] font-semibold"
                  placeholder="Untitled agent"
                  placeholderTextColor={colors.faint}
                  value={field.state.value}
                  onChangeText={(text) => field.handleChange(text)}
                  autoCapitalize="words"
                />
              )}
            </form.Field>
            <Text variant="muted" className="mt-1 text-[13px]">
              Give your agent a name
            </Text>
          </View>

          {/* Settings */}
          <View className="gap-7">
            <View className="gap-2.5">
              <SectionLabel>Input language</SectionLabel>
              <form.Field name="inputLang">
                {(field) => (
                  <ChipGroup
                    options={LANGUAGES}
                    value={field.state.value}
                    onChange={(v) => field.handleChange(v)}
                  />
                )}
              </form.Field>
            </View>

            <View className="gap-2.5">
              <SectionLabel>Output language</SectionLabel>
              <form.Field name="outputLang">
                {(field) => (
                  <ChipGroup
                    options={LANGUAGES}
                    value={field.state.value}
                    onChange={(v) => field.handleChange(v)}
                  />
                )}
              </form.Field>
            </View>

            <View className="gap-2.5">
              <SectionLabel>Mode</SectionLabel>
              <form.Field name="mode">
                {(field) => (
                  <ModeList
                    value={field.state.value}
                    onChange={(v) => field.handleChange(v)}
                  />
                )}
              </form.Field>
            </View>

            <View className="gap-2.5">
              <SectionLabel>Voice gender</SectionLabel>
              <form.Field name="gender">
                {(field) => (
                  <ChipGroup
                    options={GENDERS}
                    value={field.state.value}
                    onChange={(v) => {
                      field.handleChange(v);
                      // The voice list is scoped to the selected gender — a
                      // voice picked under the old one won't be in the new
                      // list, so it'd sit selected but invisible.
                      form.setFieldValue("voice", null);
                    }}
                  />
                )}
              </form.Field>
            </View>

            <View className="gap-2.5">
              <SectionLabel>Voice</SectionLabel>
              {/* Nested (not a single Subscribe selecting [gender, voice])
                  because that selector would return a fresh array on every
                  store update — form.Subscribe compares with `===`, so a
                  new array never bails out and this would re-render on any
                  field change, not just gender/voice. Each form.Field here
                  subscribes to only its own field's store instead. */}
              <form.Field name="gender">
                {(genderField) => (
                  <form.Field name="voice">
                    {(voiceField) => (
                      <VoiceGroupPicker
                        gender={genderField.state.value}
                        value={voiceField.state.value}
                        onChange={(v) => voiceField.handleChange(v)}
                        onPreview={handlePreviewVoice}
                        previewingVoice={previewingVoice}
                        playingVoice={playingVoice}
                      />
                    )}
                  </form.Field>
                )}
              </form.Field>
            </View>
          </View>
        </ScrollView>

        <FormFooter
          form={form}
          editingAgent={editingAgent}
          isEditing={isEditing}
          isSaving={isSaving}
          error={error}
          colors={colors}
          insets={insets}
          handleTryAgent={handleTryAgent}
        />
      </KeyboardAvoidingView>

      <SaveChangesAlert
        open={showSaveFirst}
        onOpenChange={setShowSaveFirst}
        description={
          isEditing
            ? "Save your changes before trying the agent."
            : "Save the agent before trying it."
        }
      />
    </SafeAreaView>
  );
}
