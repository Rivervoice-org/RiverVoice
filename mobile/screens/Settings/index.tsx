import { memo, useMemo, useState } from "react";
import { ScrollView, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Constants from "expo-constants";
import {
  Bell,
  ChevronRight,
  CircleHelp,
  CircleUserRound,
  FileText,
  Headphones,
  LogOut,
  Monitor,
  MessageSquareText,
  Moon,
  ShieldCheck,
  Sun,
} from "lucide-react-native";
import { useAuth } from "@/hooks/use-auth";
import { MascotPicker } from "@/components/MascotPicker";
import { SignInPrompt } from "@/components/SignInPrompt";
import { Card } from "@/components/ui/card";
import { Rise } from "@/components/ui/rise";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { useTheme, useThemeColors, type ThemePreference } from "@/lib/theme";

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

const noop = () => {};

/**
 * Built once per scheme (not per render) so a memoized Row still only sees
 * a new icon node when the theme actually changes.
 */
function buildIcons(ink: string) {
  return {
    transcript: <MessageSquareText size={14} strokeWidth={1.75} color={ink} />,
    bell: <Bell size={14} strokeWidth={1.75} color={ink} />,
    shield: <ShieldCheck size={14} strokeWidth={1.75} color={ink} />,
    help: <CircleHelp size={14} strokeWidth={1.75} color={ink} />,
    headset: <Headphones size={14} strokeWidth={1.75} color={ink} />,
    doc: <FileText size={14} strokeWidth={1.75} color={ink} />,
  };
}

/**
 * Every row shares one shape — icon chip, label (+ optional description),
 * then either a trailing control (switch/select) or a chevron if it navigates.
 * The rest of the app puts icons inside a bg-secondary chip (StatCard,
 * CallRow, AgentDetail's numbers list); Settings previously floated bare
 * icons, which is what read as inconsistent.
 *
 * Memoized because every toggle lives in SettingsScreen — without it, one
 * switch flip re-renders all six rows and the mascot picker. The switch is
 * built here from stable props so only the toggled row sees new props.
 */
const Row = memo(function Row({
  icon,
  label,
  description,
  value,
  switchChecked,
  onSwitchChange,
  onPress,
  last,
}: {
  icon?: React.ReactNode;
  label: string;
  description?: string;
  value?: string;
  switchChecked?: boolean;
  onSwitchChange?: (checked: boolean) => void;
  onPress?: () => void;
  last?: boolean;
}) {
  const colors = useThemeColors();
  const control =
    switchChecked !== undefined && onSwitchChange ? (
      <Switch checked={switchChecked} onCheckedChange={onSwitchChange} />
    ) : null;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className={cn(
        "flex-row items-center gap-3 bg-card px-4 py-3 active:bg-secondary",
        !last && "border-b border-border"
      )}
    >
      {icon ? (
        <View className="h-8 w-8 items-center justify-center rounded-lg bg-secondary">
          {icon}
        </View>
      ) : null}
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-medium">{label}</Text>
        {description ? (
          <Text variant="muted" className="mt-0.5 text-[12px]">
            {description}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="muted" className="text-[13px]">
          {value}
        </Text>
      ) : null}
      {control}
      {onPress && !control ? (
        <ChevronRight size={16} strokeWidth={1.75} color={colors.muted} />
      ) : null}
    </Pressable>
  );
});

/**
 * Owns the mascot's local `useState` itself — picking a mascot only needs
 * to re-render this block, not the rest of Settings (Appearance, Calls,
 * Privacy switches, etc.), which the old code did by keeping that state up
 * in SettingsScreen.
 */
function ProfileSection() {
  const { user, isAuthenticated } = useAuth();
  const colors = useThemeColors();
  const [mascot, setMascot] = useState<string | undefined>(undefined);

  if (!isAuthenticated) {
    return (
      <SignInPrompt
        icon={<CircleUserRound size={22} strokeWidth={1.75} color={colors.faint} />}
        message="Sign in to see your profile"
      />
    );
  }

  return (
    <View className="items-center px-6 pt-6 pb-8">
      <MascotPicker value={mascot} onSelect={setMascot} />
      <Text className="mt-3 text-[20px] font-semibold">{user?.name || "You"}</Text>
      {user?.phone ? (
        <Text variant="muted" className="mt-0.5 text-[13px]">
          +{user.phone}
        </Text>
      ) : null}
      <Text variant="muted" className="mt-1 text-[12px]">
        Tap the face to change your mascot
      </Text>
    </View>
  );
}

const APPEARANCE_OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

function AppearancePicker() {
  const { preference, setPreference } = useTheme();
  const colors = useThemeColors();

  return (
    <View className="flex-row gap-2 px-4 py-3">
      {APPEARANCE_OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = preference === value;
        return (
          <Pressable
            key={value}
            onPress={() => setPreference(value)}
            className={cn(
              "flex-1 flex-row items-center justify-center gap-1.5 rounded-lg border py-2",
              active ? "border-foreground bg-foreground" : "border-border bg-transparent"
            )}
          >
            <Icon size={14} strokeWidth={1.75} color={active ? colors.onInk : colors.muted} />
            <Text
              className={cn(
                "text-[13px] font-medium",
                active ? "text-primary-foreground" : "text-muted-foreground"
              )}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function SettingsScreen() {
  const { signOut, isAuthenticated } = useAuth();
  const colors = useThemeColors();
  const ICONS = useMemo(() => buildIcons(colors.ink), [colors.ink]);
  const [transcribeVoicemails, setTranscribeVoicemails] = useState(true);
  const [missedCallAlerts, setMissedCallAlerts] = useState(true);
  const [keepRecordings, setKeepRecordings] = useState(true);
  const [shareDiagnostics, setShareDiagnostics] = useState(false);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      {/* Header — matches the other tab roots (Agents, My numbers) */}
      <Rise index={0}>
        <View className="px-5 pt-3 pb-1">
          <Text className="text-[28px] font-semibold tracking-[-0.02em]">
            Settings
          </Text>
          <Text variant="muted" className="mt-1 text-sm">
            Your account and app preferences
          </Text>
        </View>
      </Rise>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile */}
        <Rise index={1}>
          <ProfileSection />
        </Rise>

        {/* Appearance */}
        <Rise index={2}>
          <View className="mt-8">
            <SectionLabel>Appearance</SectionLabel>
            <Card className="mx-5 mt-2.5 overflow-hidden">
              <AppearancePicker />
            </Card>
          </View>
        </Rise>

        {/* Calls */}
        {isAuthenticated ? (
          <Rise index={3}>
            <View className="mt-8">
              <SectionLabel>Calls</SectionLabel>
              <Card className="mx-5 mt-2.5 overflow-hidden">
                <Row
                  icon={ICONS.transcript}
                  label="Voicemail transcripts"
                  description="Text you a transcript of every voicemail"
                  switchChecked={transcribeVoicemails}
                  onSwitchChange={setTranscribeVoicemails}
                />
                <Row
                  icon={ICONS.bell}
                  label="Missed call alerts"
                  description="Notify me when a call goes unanswered"
                  switchChecked={missedCallAlerts}
                  onSwitchChange={setMissedCallAlerts}
                  last
                />
              </Card>
            </View>
          </Rise>
        ) : null}

        {/* Privacy */}
        {isAuthenticated ? (
          <Rise index={4}>
            <View className="mt-8">
              <SectionLabel>Privacy</SectionLabel>
              <Card className="mx-5 mt-2.5 overflow-hidden">
                <Row
                  icon={ICONS.shield}
                  label="Keep call recordings"
                  description="Store audio after the call ends"
                  switchChecked={keepRecordings}
                  onSwitchChange={setKeepRecordings}
                />
                <Row
                  icon={ICONS.shield}
                  label="Share diagnostics"
                  description="Send crash and usage data to improve the app"
                  switchChecked={shareDiagnostics}
                  onSwitchChange={setShareDiagnostics}
                  last
                />
              </Card>
            </View>
          </Rise>
        ) : null}

        {/* Support */}
        <Rise index={5}>
          <View className="mt-8">
            <SectionLabel>Support</SectionLabel>
            <Card className="mx-5 mt-2.5 overflow-hidden">
              <Row icon={ICONS.help} label="Help center" onPress={noop} />
              <Row icon={ICONS.headset} label="Contact support" onPress={noop} />
              <Row icon={ICONS.doc} label="Terms of service" onPress={noop} />
              <Row icon={ICONS.doc} label="Privacy policy" onPress={noop} last />
            </Card>
          </View>
        </Rise>

        {/* About */}
        <Rise index={6}>
          <View className="mt-8">
            <SectionLabel>About</SectionLabel>
            <Card className="mx-5 mt-2.5 overflow-hidden">
              <Row label="Version" value={Constants.expoConfig?.version ?? "1.0.0"} last />
            </Card>

            {isAuthenticated ? (
              <View className="items-center pt-8">
                <Button variant="outline" onPress={signOut} className="px-5">
                  <LogOut size={16} strokeWidth={1.75} color={colors.destructive} />
                  <Text variant="destructive" className="text-sm font-medium">
                    Sign out
                  </Text>
                </Button>
              </View>
            ) : null}
          </View>
        </Rise>
      </ScrollView>
    </SafeAreaView>
  );
}
