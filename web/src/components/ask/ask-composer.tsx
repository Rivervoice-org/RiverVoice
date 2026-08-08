"use client";

import * as React from "react";
import { ArrowUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function AskComposer({
  onSubmit,
  placeholder,
  hint,
  rows = 3,
  autoFocus,
  busy,
  className,
}: {
  onSubmit?: (question: string) => void;
  placeholder: string;
  hint?: React.ReactNode;
  rows?: number;
  autoFocus?: boolean;
  busy?: boolean;
  className?: string;
}) {
  const [draft, setDraft] = React.useState("");
  const ready = draft.trim().length > 0 && !busy;

  const send = () => {
    if (!ready) return;
    onSubmit?.(draft.trim());
    setDraft("");
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
      className={cn(
        "rounded-2xl border border-foreground/15 bg-muted/50 transition-all focus-within:border-foreground/30 focus-within:bg-card",
        className,
      )}
    >
      <Textarea
        rows={rows}
        autoFocus={autoFocus}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            send();
          }
        }}
        aria-label="Ask Rivervoice"
        placeholder={placeholder}
        className="max-h-56 min-h-20 resize-none border-0 bg-transparent px-3.5 pt-3 pb-1 text-sm shadow-none focus-visible:border-0 focus-visible:ring-0 md:text-sm dark:bg-transparent"
      />

      <div className="flex items-center gap-2 px-3.5 pb-2.5">
        {hint ? (
          <span className="flex min-w-0 items-center gap-2 truncate text-[11px] text-muted-foreground">
            {hint}
          </span>
        ) : null}

        <Button
          type="submit"
          size="icon"
          disabled={!ready}
          aria-label="Send"
          className="ml-auto size-8 rounded-full disabled:opacity-30"
        >
          <ArrowUp />
        </Button>
      </div>
    </form>
  );
}
