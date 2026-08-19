import { useState } from "react";
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

/**
 * Every row shares one shape — icon chip, label (+ optional description),
 * then either a trailing control (switch/select) or a chevron if it navigates.
 * The rest of the app puts icons inside a bg-secondary chip (StatCard,
 * CallRow, AgentDetail's numbers list); Settings previously floated bare
 * icons, which is what read as inconsistent.
 */
function Row({
  icon,
  label,
  description,
  value,
  trailing,
  onPress,
  last,
}: {
  icon?: React.ReactNode;
  label: string;
  description?: string;
  value?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
  last?: boolean;
}) {
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
      {trailing}
      {onPress && !trailing ? (
        <ChevronRight size={16} strokeWidth={1.75} color="#8f8c87" />
      ) : null}
    </Pressable>
  );
}

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
            icon={<MessageSquareText size={14} strokeWidth={1.75} color="#3c3832" />}
            label="Voicemail transcripts"
            description="Text you a transcript of every voicemail"
            trailing={
              <Switch
                checked={transcribeVoicemails}
                onCheckedChange={setTranscribeVoicemails}
              />
            }
          />
          <Row
            icon={<Bell size={14} strokeWidth={1.75} color="#3c3832" />}
            label="Missed call alerts"
            description="Notify me when a call goes unanswered"
            trailing={
              <Switch checked={missedCallAlerts} onCheckedChange={setMissedCallAlerts} />
            }
            last
          />
        </Card>

        {/* Privacy */}
        <SectionLabel>Privacy</SectionLabel>
        <Card className="mx-5 mt-2.5 overflow-hidden">
          <Row
            icon={<ShieldCheck size={14} strokeWidth={1.75} color="#3c3832" />}
            label="Keep call recordings"
            description="Store audio after the call ends"
            trailing={
              <Switch checked={keepRecordings} onCheckedChange={setKeepRecordings} />
            }
          />
          <Row
            icon={<ShieldCheck size={14} strokeWidth={1.75} color="#3c3832" />}
            label="Share diagnostics"
            description="Send crash and usage data to improve the app"
            trailing={
              <Switch checked={shareDiagnostics} onCheckedChange={setShareDiagnostics} />
            }
            last
          />
        </Card>

        {/* Support */}
        <SectionLabel>Support</SectionLabel>
        <Card className="mx-5 mt-2.5 overflow-hidden">
          <Row
            icon={<CircleHelp size={14} strokeWidth={1.75} color="#3c3832" />}
            label="Help center"
            onPress={() => {}}
          />
          <Row
            icon={<Headphones size={14} strokeWidth={1.75} color="#3c3832" />}
            label="Contact support"
            onPress={() => {}}
          />
          <Row
            icon={<FileText size={14} strokeWidth={1.75} color="#3c3832" />}
            label="Terms of service"
            onPress={() => {}}
          />
          <Row
            icon={<FileText size={14} strokeWidth={1.75} color="#3c3832" />}
            label="Privacy policy"
            onPress={() => {}}
            last
          />
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
