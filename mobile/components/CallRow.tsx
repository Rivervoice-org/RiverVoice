import * as React from "react";
import { View, Pressable } from "react-native";
import {
  Phone,
  PhoneOutgoing,
  PhoneIncoming,
  PhoneMissed,
} from "lucide-react-native";
import { Mascot } from "./Mascot";
import { Text } from "./ui/text";
import { cn } from "@/lib/utils";

export enum CallOutcome {
  Resolved = "resolved",
  Transferred = "transferred",
  Missed = "missed",
}

export type CallRowItem = {
  id: string;
  number: string;
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
  showDivider?: boolean;
  onPress?: () => void;
};

export function CallOutcomeAvatar({ outcome }: { outcome: CallOutcome }) {
  switch (outcome) {
    case CallOutcome.Resolved:
      return (
        <View className="h-8 w-8 items-center justify-center rounded-lg bg-secondary">
          <PhoneIncoming size={14} strokeWidth={1.75} color="#2a8c4d" />
        </View>
      );
    case CallOutcome.Transferred:
      return (
        <View className="h-8 w-8 items-center justify-center rounded-lg bg-secondary">
          <PhoneOutgoing size={14} strokeWidth={1.75} color="#3b5dab" />
        </View>
      );
    case CallOutcome.Missed:
      return (
        <View className="h-8 w-8 items-center justify-center rounded-lg bg-secondary">
          <PhoneMissed size={14} strokeWidth={1.75} color="#c43030" />
        </View>
      );
    default:
      return (
        <View className="h-8 w-8 items-center justify-center rounded-lg bg-secondary">
          <Phone size={14} strokeWidth={1.75} color="#8f8c87" />
        </View>
      );
  }
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
            <Text className={cn("text-sm font-medium", mono && "font-mono")}>
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
