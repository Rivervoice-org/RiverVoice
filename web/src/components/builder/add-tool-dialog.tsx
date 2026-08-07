"use client";

import { Check, FlaskConical, Link2, MessageCircle } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type ToolKind = "api" | "validator" | "mock" | "messaging";

const KINDS: {
  kind: ToolKind;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}[] = [
  {
    kind: "api",
    name: "API Tool",
    description: "Call your API to fetch or update data, such as a caller's booking details.",
    icon: Link2,
  },
  {
    kind: "validator",
    name: "Data Validator",
    description: "Check a value's format and validity, such as an email or phone number.",
    icon: Check,
  },
  {
    kind: "mock",
    name: "Mock API",
    description: "Test tool calls before your API exists.",
    icon: FlaskConical,
  },
  {
    kind: "messaging",
    name: "Message on Telegram",
    description: "Give the agent its own bot, so it can post a summary to a group after a call.",
    icon: MessageCircle,
  },
];

export function AddToolDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (kind: ToolKind) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-6 rounded-2xl p-6 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-medium">Add a tool</DialogTitle>
          <DialogDescription className="sr-only">
            Pick the kind of tool this agent should be able to call mid-conversation.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-3">
          {KINDS.map(({ kind, name, description, icon: Icon }) => (
            <button
              key={kind}
              type="button"
              onClick={() => onSelect(kind)}
              className="flex cursor-pointer flex-col items-start gap-3 rounded-xl border border-border p-5 text-left transition-colors hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <span className="flex size-10 items-center justify-center rounded-lg bg-muted">
                <Icon className="size-5 text-muted-foreground" strokeWidth={1.75} />
              </span>
              <span className="text-[15px] font-medium">{name}</span>
              <span className="text-[13px] leading-6 text-muted-foreground">{description}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
