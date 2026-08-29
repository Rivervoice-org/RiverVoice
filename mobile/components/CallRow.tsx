import * as React from "react";
import { View, Pressable } from "react-native";
import {
  Phone,
  PhoneOutgoing,
  PhoneIncoming,
  PhoneMissed,
  ChevronRight,
} from "lucide-react-native";
import { InitialsAvatar } from "./InitialsAvatar";
import { Text } from "./ui/text";
import { cn } from "@/lib/utils";
import { useThemeColors } from "@/lib/theme";

export enum CallOutcome {
  Resolved = "resolved",
  Transferred = "transferred",
  Missed = "missed",
}

export type CallRowItem = {
  id: string;
  name: string;
  number: string;
  fromNumber: string;
  /** Null once the agent is deleted, which is what makes the row un-redialable. */
  agentId: string | null;
  agent: string | null;
  language: string;
  duration: string;
  outcome: CallOutcome;
  time: string;
};

type CallRowProps = {
  avatar?: React.ReactNode;
  title: React.ReactNode;
  mono?: boolean;
  titleRight?: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  showDivider?: boolean | undefined;
  onPress?: () => void;
};

export function CallOutcomeAvatar({ outcome }: { outcome: CallOutcome }) {
  const colors = useThemeColors();
  switch (outcome) {
    case CallOutcome.Resolved:
      return (
        <View className="h-8 w-8 items-center justify-center rounded-lg bg-secondary">
          <PhoneIncoming size={14} strokeWidth={1.75} color={colors.green} />
        </View>
      );
    case CallOutcome.Transferred:
      return (
        <View className="h-8 w-8 items-center justify-center rounded-lg bg-secondary">
          <PhoneOutgoing size={14} strokeWidth={1.75} color={colors.river} />
        </View>
      );
    case CallOutcome.Missed:
      return (
        <View className="h-8 w-8 items-center justify-center rounded-lg bg-secondary">
          <PhoneMissed size={14} strokeWidth={1.75} color={colors.destructive} />
        </View>
      );
    default:
      return (
        <View className="h-8 w-8 items-center justify-center rounded-lg bg-secondary">
          <Phone size={14} strokeWidth={1.75} color={colors.muted} />
        </View>
      );
  }
}

export function CallListItem({
  call,
  showDivider,
  onPress,
}: {
  call: CallRowItem;
  showDivider?: boolean;
  onPress?: () => void;
}) {
  const colors = useThemeColors();
  // the row itself is inert; the chevron is the only tap target
  // An unknown number titles the row itself (see `title` below), so it is
  // never repeated here.
  const meta = `${call.agent ? `${call.agent} · ` : ""}${call.language}`;
  return (
    <CallRow
      avatar={
        call.name ? (
          <InitialsAvatar name={call.name} size={32} />
        ) : (
          <CallOutcomeAvatar outcome={call.outcome} />
        )
      }
      title={call.name || call.number}
      subtitle={
        <View className="flex-row items-center gap-1">
          <Text variant="muted" className="text-[11px]" numberOfLines={1}>
            {meta}
          </Text>
          <Text
            font="mono"
            variant="muted"
            className="text-[11px] tabular-nums"
          >
            · {call.duration}
          </Text>
        </View>
      }
      trailing={
        <View className="flex-row items-center gap-1.5">
          <Text variant="muted" className="text-[11px]">
            {call.time}
          </Text>
          {onPress && (
            <Pressable
              hitSlop={8}
              onPress={(event) => {
                event.stopPropagation();
                onPress();
              }}
              className="items-center justify-center rounded-full p-1 active:opacity-70"
            >
              <ChevronRight size={14} strokeWidth={1.75} color={colors.muted} />
            </Pressable>
          )}
        </View>
      }
      showDivider={showDivider}
    />
  );
}

export function CallRow({
  avatar,
  title,
  mono,
  titleRight,
  subtitle,
  trailing,
  showDivider,
  onPress,
}: CallRowProps) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        "flex-row items-center gap-3 px-4 py-3",
        showDivider && "border-b border-border"
      )}
    >
      {avatar}
      <View className="flex-1 min-w-0">
        <View className="flex-row items-center gap-1.5">
          {typeof title === "string" ? (
            <Text
              numberOfLines={1}
              className={cn("min-w-0 flex-1 text-sm font-medium", mono && "font-mono")}
            >
              {title}
            </Text>
          ) : (
            title
          )}
          {titleRight}
        </View>
        {typeof subtitle === "string" ? (
          <Text variant="muted" className="text-[11px]" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : (
          subtitle
        )}
      </View>
      {trailing}
    </Pressable>
  );
}
