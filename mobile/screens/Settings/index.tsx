import { memo, useState } from "react";
import { ScrollView, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Constants from "expo-constants";
import {
  Bell,
  ChevronRight,
  CircleHelp,
  FileText,
  Headphones,
  LogOut,
  MessageSquareText,
  ShieldCheck,
} from "lucide-react-native";
import { useAuth } from "@/hooks/use-auth";
import { MascotPicker } from "@/components/MascotPicker";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

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
 * Module-level so their identity never changes — a memoized Row has to see
 * the same icon node across renders or it re-renders anyway.
 */
const ICONS = {
  transcript: <MessageSquareText size={14} strokeWidth={1.75} color="#3c3832" />,
  bell: <Bell size={14} strokeWidth={1.75} color="#3c3832" />,
  shield: <ShieldCheck size={14} strokeWidth={1.75} color="#3c3832" />,
  help: <CircleHelp size={14} strokeWidth={1.75} color="#3c3832" />,
  headset: <Headphones size={14} strokeWidth={1.75} color="#3c3832" />,
  doc: <FileText size={14} strokeWidth={1.75} color="#3c3832" />,
};

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
        <ChevronRight size={16} strokeWidth={1.75} color="#8f8c87" />
      ) : null}
    </Pressable>
  );
});

export default function SettingsScreen() {
  const { signOut, user } = useAuth();
  const [mascot, setMascot] = useState<string | undefined>(undefined);
  const [transcribeVoicemails, setTranscribeVoicemails] = useState(true);
  const [missedCallAlerts, setMissedCallAlerts] = useState(true);
  const [keepRecordings, setKeepRecordings] = useState(true);
  const [shareDiagnostics, setShareDiagnostics] = useState(false);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      {/* Header — matches the other tab roots (Agents, My numbers) */}
      <View className="px-5 pt-3 pb-1">
        <Text className="text-[28px] font-semibold tracking-[-0.02em]">
          Settings
        </Text>
        <Text variant="muted" className="mt-1 text-sm">
          Your account and app preferences
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile */}
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

        {/* Calls */}
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

        {/* Privacy */}
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

        {/* Support */}
        <SectionLabel>Support</SectionLabel>
        <Card className="mx-5 mt-2.5 overflow-hidden">
          <Row icon={ICONS.help} label="Help center" onPress={noop} />
          <Row icon={ICONS.headset} label="Contact support" onPress={noop} />
          <Row icon={ICONS.doc} label="Terms of service" onPress={noop} />
          <Row icon={ICONS.doc} label="Privacy policy" onPress={noop} last />
        </Card>

        {/* About */}
        <SectionLabel>About</SectionLabel>
        <Card className="mx-5 mt-2.5 overflow-hidden">
          <Row label="Version" value={Constants.expoConfig?.version ?? "1.0.0"} last />
        </Card>

        <View className="items-center pt-8">
          <Button variant="outline" onPress={signOut} className="px-5">
            <LogOut size={16} strokeWidth={1.75} color="#c4384c" />
            <Text variant="destructive" className="text-sm font-medium">
              Sign out
            </Text>
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
